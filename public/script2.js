/* ==========================================================================
   SECTION 1: DASHBOARD INITIALIZATION & LOCAL STATE MANAGEMENT
   ========================================================================== */

/* Block 1: HARDWARE INITIALIZATION SERVICE RUNTIME */
window.onload = () => {
    console.log("Age Portal Matrix Loaded. Isolated Core Active.");
    
    // A. SECURE LOCAL RETRIEVAL HANDSHAKES: Pull saved keys directly out from device profile caches
    const savedCommanderUser = localStorage.getItem("activeCommanderUser") || "testaccount";

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
    const userTagElement = document.getElementById("logged-user-tag");
    if (userTagElement) {
        userTagElement.innerText = (typeof player !== "undefined" && player.name) ? player.name : savedCommanderUser;
    }
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
    initializePortalLivePlayerMetrics();
    if (typeof initializeDeveloperMaintenanceAlert === 'function') {
        initializeDeveloperMaintenanceAlert();
    }

    applyPortalNavPreviewRestrictions();
    hydrateDevelopersLogDock();

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

    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (viewport) {
        window.cachedAgePortalViewportHTML = viewport.innerHTML;
    }
};

/* Block 2: Persistent Era Time Countdown Ticker */
function initializeServerAgeClockTickerCountdown() {
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

const PORTAL_PREVIEW_ONLY_VIEWS = ['discoveries', 'royalty', 'chronicles'];

/** True on Live Server :5500 and other local dev hosts; false on royalarmies.com production. */
function isPortalPreviewNavEnabled() {
    const host = window.location.hostname.toLowerCase();
    const port = window.location.port;

    if (port === '5500') return true;

    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalHost && (port === '' || port === '3000' || port === '5500' || port === '5173')) {
        return true;
    }

    return false;
}

function applyPortalNavPreviewRestrictions() {
    const previewEnabled = isPortalPreviewNavEnabled();

    document.querySelectorAll('.nav-tab[data-portal-view]').forEach((tab) => {
        const viewName = tab.getAttribute('data-portal-view');
        if (!PORTAL_PREVIEW_ONLY_VIEWS.includes(viewName)) return;

        if (previewEnabled) {
            tab.classList.remove('nav-tab-preview-locked');
            tab.removeAttribute('aria-disabled');
            tab.title = '';
        } else {
            tab.classList.add('nav-tab-preview-locked');
            tab.setAttribute('aria-disabled', 'true');
            tab.title = 'Coming soon';
            tab.classList.remove('active');
        }
    });

    if (!previewEnabled && PORTAL_PREVIEW_ONLY_VIEWS.includes(activeMainPortalView)) {
        switchMainPortalView('portal', null);
        document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
        const agePortalTab = Array.from(document.querySelectorAll('.nav-tab')).find(
            (tab) => !PORTAL_PREVIEW_ONLY_VIEWS.includes(tab.getAttribute('data-portal-view'))
                && tab.textContent.trim() === 'Age Portal'
        );
        if (agePortalTab) agePortalTab.classList.add('active');
    }
}

/* Block 3: EXTENSIBLE SYSTEM PANEL VIEW CONVERTER SWITCH (ROUTING RECONCILED) */
function switchMainPortalView(viewName, clickEvent, chatChannelKey) {
    if (PORTAL_PREVIEW_ONLY_VIEWS.includes(viewName) && !isPortalPreviewNavEnabled()) {
        return;
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
        stopCommunityChatPresenceLoop();
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
                initializeTacticalButtonEarthquakeEngine();
            } else {
                restoreAgePortalHomeViewLayout(viewport);
            }
            break;

        case 'chat':
            renderCommunityChatPortalCanvas(viewport);
            startCommunityChatPresenceLoop();
            break;

        case 'leaderboards':
            renderMasterLeaderboardPortalCanvas(viewport);
            break;

        case 'discoveries':
            renderMasterDiscoveriesPortalCanvas(viewport);
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
}

/** Release IDs from CHRONICLE_DATA (script.js), newest first — shown in Developer's Log sidebar. */
const DEVELOPER_LOG_RELEASE_IDS = ['alpha_0111'];

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

    const entries = DEVELOPER_LOG_RELEASE_IDS.map((id) => CHRONICLE_DATA[id]).filter(Boolean);
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
        <article class="dashboard-news-card-box">
            <h2 class="card-title-header">Developer's Log</h2>
            <div class="card-scrollable-body-text" id="dashboard-patch-notes-dock">
                ${renderDevelopersLogMarkup()}
            </div>
        </article>
    `;
}

function hydrateDevelopersLogDock() {
    const dock = document.getElementById('dashboard-patch-notes-dock');
    if (dock) dock.innerHTML = renderDevelopersLogMarkup();
}

function restoreAgePortalHomeViewLayout(viewport) {
    viewport.innerHTML = `
        <div class="age-portal-view-canvas" id="panel-age-portal-mode">
            <div class="portal-twin-split-deck-row">
                <article class="dashboard-news-card-box">
                    <h2 class="card-title-header">👑 Introduction Into Royal Armies</h2>
                    <div class="card-scrollable-body-text">
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
            <div class="portal-deployment-control-deck">
                <h3 class="deployment-deck-title" id="dynamic-age-status-header">Loading age status...</h3>
                <div id="dynamic-age-sub-timer-display" class="timer-readout-default"></div>
                <div class="deployment-action-button-row">
                    <div class="action-btn-aura-housing aura-glow-red">
                        <button class="deployment-image-trigger-btn" onclick="launchGameRoundSector(false, event)">
                            <img src="images/joinagebtn.png" alt="Join active age">
                        </button>
                    </div>
                    <div class="action-btn-aura-housing aura-glow-blue">
                        <button class="deployment-image-trigger-btn" onclick="launchGameRoundSector(true, event)">
                            <img src="images/joinagetutorialbtn.png" alt="Join tutorial age">
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    hydrateDevelopersLogDock();
    initializeTacticalButtonEarthquakeEngine();
}

/* Block 4: MAP INTERFACE DEPLOYMENT SECTOR ROUTER */
const JOIN_AGE_POST_SELECT_DELAY_MS = 400;
const JOIN_AGE_DEPLOY_PULSE_GROW_MS = 420;
const JOIN_AGE_DEPLOY_PULSE_SETTLE_MS = 720;

let joinAgePortalTransitionActive = false;

function launchGameRoundSector(isTutorialModeActive, clickEvent) {
    if (joinAgePortalTransitionActive) return;
    joinAgePortalTransitionActive = true;

    const clickedHousing = clickEvent?.target?.closest?.('.action-btn-aura-housing')
        ?? clickEvent?.currentTarget?.closest?.('.action-btn-aura-housing');

    haltAllPortalAudioForGameLaunch();
    resetAllJoinAgeDeploymentButtonShakeStates();

    let deployPulseFinished = false;
    let selectAudioFinished = false;

    const attemptGamePageHandoff = () => {
        if (!deployPulseFinished || !selectAudioFinished) return;
        const destination = `game.html?tutorial=${isTutorialModeActive}`;
        window.setTimeout(() => {
            localStorage.setItem('savedCommanderInActiveAge', 'true');
            notifyPortalAgeSessionJoin().finally(() => {
                window.location.href = destination;
            });
        }, JOIN_AGE_POST_SELECT_DELAY_MS);
    };

    if (clickedHousing) {
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
        localStorage.removeItem('activeCommanderUser');
        sessionStorage.removeItem('royalArmiesAuthAudioPlay');
        window.location.href = 'index.html';
    };

    clearPortalPresenceSession().finally(redirectHome);
}

/* ==========================================================================
   LIVE PORTAL PLAYER METRICS (registered + online rosters)
   ========================================================================== */

let portalMetricsPollTimer = null;
let portalPresenceHeartbeatTimer = null;
let communityChatPresencePollTimer = null;
const PORTAL_PRESENCE_HEARTBEAT_MS = 20000;
const CHAT_PRESENCE_HEARTBEAT_MS = 8000;
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

async function sendPortalPresenceHeartbeat() {
    const username = resolvePortalPresenceUsername();
    if (!username || username.toLowerCase() === 'testaccount') return null;

    try {
        const response = await fetch('/api/portal/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                inAge: isCommanderPlayingActiveAgeLocally()
            }),
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`presence ${response.status}`);
        const metrics = await response.json();
        applyPortalMetricsPayload(metrics);
        return metrics;
    } catch (err) {
        console.warn('Portal presence heartbeat failed:', err);
        return null;
    }
}

function startCommunityChatPresenceLoop() {
    if (communityChatPresencePollTimer) clearInterval(communityChatPresencePollTimer);

    const pulse = () => {
        sendPortalPresenceHeartbeat();
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
        const rankIndex = Math.max(0, Math.min(player.rank - 1, 21));
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

function getChatRosterStatusMeta(inAge, isSelf) {
    if (isSelf && inAge) {
        return { pillClass: 'chat-roster-status-pill--self-age', icon: '⚔', label: 'You · In Age' };
    }
    if (isSelf) {
        return { pillClass: 'chat-roster-status-pill--self', icon: '◆', label: 'You' };
    }
    if (inAge) {
        return { pillClass: 'chat-roster-status-pill--in-age', icon: '⚔', label: 'In Age' };
    }
    return { pillClass: 'chat-roster-status-pill--portal', icon: '◈', label: 'Portal' };
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

window.toggleChatRosterCardExpand = toggleChatRosterCardExpand;
window.handleChatRosterCardExpandKeydown = handleChatRosterCardExpandKeydown;

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
            <div class="chat-roster-avatar-wrap">
                <div class="chat-roster-avatar chat-roster-avatar--royal-guard-bot" aria-hidden="true">🛡</div>
                <span class="chat-roster-presence-ring" aria-hidden="true"></span>
                <span class="chat-roster-avatar-bot-mark" aria-hidden="true">🤖</span>
            </div>
            <div class="chat-roster-commander-body">
                <div class="chat-roster-commander-topline">
                    <span class="chat-roster-name">${escapeMetricRosterHtml(botName)}</span>
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

function buildCommunityChatRosterCardMarkup(name, selfLower, playingSet) {
    if (isRoyalGuardBotUsername(name)) return '';
    const isSelf = normalizeCommunityChatUsername(name) === selfLower;
    const inAge = playingSet.has(normalizeCommunityChatUsername(name));
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
    const status = getChatRosterStatusMeta(inAge, isSelf);
    const isExpandable = isChatRosterCardExpandable(staffRole);
    const expandKey = isExpandable ? getChatRosterExpandKey(name, staffRole) : '';
    const isExpanded = isExpandable && chatRosterExpandedCommanders.has(expandKey);
    const cardModifiers = [
        staffRole === 'owner' ? 'chat-roster-commander-card--owner' : '',
        staffRole === 'moderator' ? 'chat-roster-commander-card--moderator' : '',
        isSelf ? 'chat-roster-commander-card--self' : '',
        inAge ? 'chat-roster-commander-card--in-age' : 'chat-roster-commander-card--portal',
        isExpandable ? 'chat-roster-commander-card--expandable' : 'chat-roster-commander-card--slim',
        isExpanded ? 'is-expanded' : ''
    ].filter(Boolean).join(' ');

    const expandPanelMarkup = isExpandable
        ? `<div class="chat-roster-commander-expand-panel" ${isExpanded ? '' : 'hidden'}>${buildChatRosterExpandPanelMarkup(name, isSelf, inAge, staffRole)}</div>`
        : '';

    const expandInteractionAttrs = isExpandable
        ? `role="button" tabindex="0" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${escapeMetricRosterHtml(name)} — click for details" data-roster-expand-key="${expandKey}" onclick="toggleChatRosterCardExpand(event)" onkeydown="handleChatRosterCardExpandKeydown(event)"`
        : '';

    return `
        <article class="chat-roster-commander-card ${cardModifiers}" data-roster-commander="${escapeMetricRosterHtml(normalizeCommunityChatUsername(name))}"${staffRole ? ` data-staff-role="${staffRole}"` : ''} ${expandInteractionAttrs}>
            <div class="chat-roster-avatar-wrap">
                <img class="chat-roster-avatar" src="${escapeMetricRosterHtml(getChatRosterAvatarUrl(name))}" alt="" width="40" height="40" loading="lazy" decoding="async">
                <span class="chat-roster-presence-ring" aria-hidden="true"></span>
                ${staffRole === 'owner' ? '<span class="chat-roster-avatar-crown" aria-hidden="true">👑</span>' : ''}
                ${staffRole === 'moderator' ? '<span class="chat-roster-avatar-mod-shield" aria-hidden="true">🛡</span>' : ''}
            </div>
            <div class="chat-roster-commander-body">
                <div class="chat-roster-commander-topline">
                    <span class="chat-roster-name">${escapeMetricRosterHtml(name)}</span>
                    <span class="chat-roster-status-pill ${status.pillClass}"><span class="chat-roster-status-pill-icon" aria-hidden="true">${status.icon}</span>${escapeMetricRosterHtml(status.label)}</span>
                    ${isExpandable ? buildChatRosterExpandHintMarkup() : ''}
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

    const seen = new Set();
    const players = [];
    (portalLiveMetricsCache.portalBrowsingPlayers || []).forEach((name) => {
        const key = normalizeCommunityChatUsername(name);
        if (!key || key === 'testaccount' || isRoyalGuardBotUsername(name) || seen.has(key)) return;
        seen.add(key);
        players.push(String(name).trim());
    });

    if (selfLower && selfLower !== 'testaccount' && !seen.has(selfLower)) {
        players.push(selfRaw.trim());
        seen.add(selfLower);
    }

    const sortedPlayers = sortCommunityChatRosterPlayers(players, selfLower, playingSet);
    const inAgeCount = sortedPlayers.filter((name) => playingSet.has(normalizeCommunityChatUsername(name))).length;

    const countEl = document.getElementById('chat-online-roster-count');
    if (countEl) countEl.textContent = String(sortedPlayers.length);

    const inAgeCountEl = document.getElementById('chat-online-in-age-count');
    if (inAgeCountEl) inAgeCountEl.textContent = String(inAgeCount);

    const botCard = buildRoyalGuardBotRosterCardMarkup();
    const humanCards = sortedPlayers
        .map((name) => buildCommunityChatRosterCardMarkup(name, selfLower, playingSet))
        .filter(Boolean)
        .join('');

    if (!sortedPlayers.length) {
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

async function notifyPortalAgeSessionJoin() {
    const username = resolvePortalPresenceUsername();
    if (!username) return;

    try {
        await fetch('/api/portal/age/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
    } catch (err) {
        console.warn('Portal age join sync failed:', err);
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
let chatMentionAlertRegistry = {};
let chatMentionAlertCounter = 0;
let userMuteExpirationRegistry = {};
let userBanExpirationRegistry = {}; 
let administrativeBehavioralReviewQueue = [];

// 🔥 STATEFUL SUSPICION TRACKERS: Tracks targeted teasing occurrences and logs chat histories behind the scenes
let playerSuspicionScoreRegistry = {};   // Structure format: { "testaccount": 2 }
let playerTeasingTranscriptHistory = {};  // Structure format: { "testaccount": ["[23:02]: get good"] }

let communityChatLogsDirectory = [];

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
    return localStorage.getItem('activeCommanderUser') || 'testaccount';
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
        recipientAlertOnly: !!logEntry.recipientAlertOnly
    };

    communityChatLogsDirectory.push(entry);
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
                    <p class="chat-roster-subtitle"><span id="chat-online-in-age-count">0</span> in the Age · click Royal Guard, Owner, or Mod for details</p>
                    <div class="chat-roster-status-legend" aria-label="Roster badges">
                        <span class="chat-roster-legend-item chat-roster-legend-item--royal-guard-bot"><span aria-hidden="true">🤖</span> Royal Guard</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--owner"><span aria-hidden="true">👑</span> Owner</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--moderator"><span aria-hidden="true">🛡</span> Mod</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--portal"><span aria-hidden="true">◈</span> Portal</span>
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
}

function toggleActiveChatChannelStream(targetChannel) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    activeChatChannelTrack = targetChannel;
    executeCommunityChatTabRenderingSequence();
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
 const tray = document.getElementById("chat-portal-input-interaction-tray");
 const currentEpochTimestamp = Date.now();

 if (userBanExpirationRegistry[loggedUser] && currentEpochTimestamp < userBanExpirationRegistry[loggedUser]) {
 if (tray) tray.innerHTML = `<div class="chat-restriction-alert-banner system-banned">🔴 You are banned from chat for 15 days because of repeated rule violations.</div>`;
 } else if (userMuteExpirationRegistry[loggedUser] && currentEpochTimestamp < userMuteExpirationRegistry[loggedUser]) {
 if (tray) tray.innerHTML = `<div class="chat-restriction-alert-banner system-muted">⏳ You are temporarily muted from chat. The mute lifts in 30 minutes.</div>`;
 } else {
 if (tray) {
 const channelLabel = getChatChannelDisplayLabel(activeChatChannelTrack);
 tray.innerHTML = `
 <input type="text" id="chat-portal-message-input-field" placeholder="Message ${channelLabel}… Use @username to shout out" onkeydown="handleChatInputFieldSubmit(event)">
 <button class="settings-btn mini-btn" onclick="executeSubmitNewPortalChatMessage()">Send</button>
 `;
 }
 }

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
 if (log.sender === loggedUser) messageRow.classList.add('local-sender-highlight-strip');
 if (isRoyalGuardBotUsername(log.sender)) messageRow.classList.add('system-bot-message-highlight');
 const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(log.sender) : null;
 if (staffRole === 'owner') messageRow.classList.add('chat-message-strip-row--owner');
 if (staffRole === 'moderator') messageRow.classList.add('chat-message-strip-row--moderator');

 let formattedTextContent = log.text.replace(/(@[a-zA-Z0-9_\-]+)/g, '<span class="chat-shoutout-mention-badge">$1</span>');
 messageRow.innerHTML = `
 <div class="chat-message-meta-left">
 <span class="chat-message-timestamp">[${log.time}]</span>
 ${formatCommunityChatSenderMarkup(log.sender)}
 </div>
 <span class="chat-message-body-text-content">${formattedTextContent}</span>
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

function executeSubmitNewPortalChatMessage() {
 const field = document.getElementById('chat-portal-message-input-field');
 if (!field) return;
 let textContent = field.value.trim();
 if (!textContent) return;

 const loggedUser = localStorage.getItem("activeCommanderUser") || "testaccount";
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

 appendCommunityChatMessage({
 channel: activeChatChannelTrack,
 sender: loggedUser,
 text: textContent,
 time: cleanTimeStr,
 visible: true,
 originalText: originalRawText
 });

 field.value = "";
 executeCompileActiveChannelMessageStrips();

 if (isViolationFound) {
 setTimeout(() => {
 appendCommunityChatMessage({
 channel: activeChatChannelTrack,
    sender: getRoyalGuardBotDisplayName(),
 text: `@${loggedUser} Severe behavioral policy violation detected. Clean up your language signature or face total chat exclusion channels.`,
 time: cleanTimeStr,
 visible: true,
 originalText: ""
 });
 if (typeof playSelectSFX === 'function') playSelectSFX();
 executeCompileActiveChannelMessageStrips();
 }, 150);
 }
}

/* Block 13: Staff Override Moderation Disciplinary Logic */
function executeStaffModerationAction(actionType, targetQueueIndex) {
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
            
            // Also trigger adaptive learning if a mute action was executed on a message card
            if (targetIncident.text) executeAutomatedTokenCrestLearning(targetIncident.text);

            communityChatLogsDirectory.forEach(log => {
                if (log.sender === offender && log.channel === targetIncident.channel) log.visible = false;
            });
            
            communityChatLogsDirectory.push({
                id: Date.now(),
                channel: targetIncident.channel,
                sender: offender,
                text: "Your communication access has been temporarily suspended for 30 minutes due to behavioral violations.",
                time: cleanTimeStr,
                visible: false,
                recipientAlertOnly: true
            });
            break;

        case 'ban':
            console.log(`MODERATOR ACTION: Banning user: ${offender}`);
            userBanExpirationRegistry[offender] = Date.now() + (15 * 24 * 60 * 60 * 1000);
            
            if (targetIncident.text) executeAutomatedTokenCrestLearning(targetIncident.text);

            communityChatLogsDirectory.forEach(log => {
                if (log.sender === offender && log.channel === targetIncident.channel) log.visible = false;
            });

            communityChatLogsDirectory.push({
                id: Date.now(),
                channel: targetIncident.channel,
                sender: offender,
                text: "Your communication access has been terminated for 15 Days due to code of conduct failures.",
                time: cleanTimeStr,
                visible: false,
                recipientAlertOnly: true
            });
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
   SECTION 6: ROYALTY PAID MEMBERSHIP (badge title + Premium Chronicle track)
   ========================================================================== */

const COMMANDER_MEMBERSHIP_STORAGE_KEY = 'savedCommanderMembershipTitle';
const ROYALTY_PAID_BADGE_TITLE = 'Royalty';
const FREE_MEMBERSHIP_BADGE_TITLE = 'Bronze';
const CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL = '$10 / month';

function getCommanderMembershipTitle() {
    const stored = localStorage.getItem(COMMANDER_MEMBERSHIP_STORAGE_KEY);
    if (stored === ROYALTY_PAID_BADGE_TITLE) return ROYALTY_PAID_BADGE_TITLE;
    if (localStorage.getItem('savedChroniclePremiumMember') === 'true') return ROYALTY_PAID_BADGE_TITLE;
    return FREE_MEMBERSHIP_BADGE_TITLE;
}

function isCommanderRoyaltyMember() {
    return getCommanderMembershipTitle() === ROYALTY_PAID_BADGE_TITLE;
}

function applyCommanderMembershipTitle(title) {
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
    document.querySelectorAll('.membership-badge').forEach((badge) => {
        badge.textContent = `${title} Member`;
        badge.className = `membership-badge tier-${tierClass}`;
    });
    document.querySelectorAll('.public-profile-membership').forEach((badge) => {
        badge.textContent = `${title} Member`;
        badge.className = `public-profile-membership tier-${tierClass}`;
    });
}

function beginRoyaltyMembershipCheckout() {
    if (typeof playSelectSFX === 'function') playSelectSFX();
    alert(
        `Royalty membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}) checkout is not live yet. ` +
        'When billing is connected, subscribing grants the Royalty badge title and unlocks Premium Tier Rewards on The Chronicles.'
    );
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
const globalRoyaltyTierPackagesDatabase = [
    {
        tier: 'Standard Commander',
        cost: 'Free',
        planVariant: 'standard',
        badge: 'FREE',
        badgeTitleGranted: FREE_MEMBERSHIP_BADGE_TITLE,
        features: [
            'Bronze membership badge on profile and public dossier',
            'Basic Chronicle Tier Rewards track (rank progression)',
            'Access to standard Ages',
            'Default message recipient limits',
            'Standard resource production rates'
        ],
        actionText: 'Current plan',
        enabled: false,
        isPaidPlan: false
    },
    {
        tier: 'Royalty',
        cost: CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL,
        planVariant: 'royalty',
        badge: 'ROYALTY',
        badgeTitleGranted: ROYALTY_PAID_BADGE_TITLE,
        features: [
            'Royalty badge title displayed on your profile and in chat',
            'Unlocks the Premium Chronicle Tier Rewards track',
            'Priority queue when servers are busy',
            'Send messages to more recipients at once',
            '+15% resource generation bonus',
            'Exclusive gold profile frame cosmetics'
        ],
        actionText: 'Unlock Premium Tier',
        enabled: true,
        isPaidPlan: true
    }
];

/* Block 16: ROYALTY MATRIX PORTAL ROUTER INTERCEPT ENGINE */
function renderRoyaltyTierPortalCanvas(viewport) {
    const isRoyalty = isCommanderRoyaltyMember();

    viewport.innerHTML = `
        <div class="royalty-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">👑 Royalty Membership</h2>
                <p class="royalty-master-subtitle">Subscribe monthly to earn the <strong>Royalty</strong> badge title and unlock <strong>Premium Tier Rewards</strong> on The Chronicles (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}). Free commanders keep the Bronze badge and the Basic reward track.</p>
            </header>
            ${isRoyalty ? `<div class="royalty-active-member-banner">You are a <strong>Royalty</strong> member — Premium Tier Rewards are unlocked on The Chronicles.</div>` : ''}
            <div class="royalty-plans-deck">
                <div class="royalty-tier-cards-flex-row">
                ${globalRoyaltyTierPackagesDatabase.map((pack) => {
                    const isActivePlan = (!pack.isPaidPlan && !isRoyalty) || (pack.isPaidPlan && isRoyalty);
                    const canSubscribe = pack.isPaidPlan && pack.enabled && !isActivePlan;
                    const actionHandler = canSubscribe ? 'onclick="beginRoyaltyMembershipCheckout()"' : '';
                    const buttonLabel = isActivePlan ? 'Active' : pack.actionText;
                    const buttonClass = canSubscribe ? 'pulse-buy-btn' : 'disabled-active-btn';
                    const badgeClass = pack.isPaidPlan
                        ? 'royalty-plan-pill royalty-plan-pill--paid'
                        : 'royalty-plan-pill royalty-plan-pill--free';
                    return `
                    <article class="royalty-package-display-card royalty-package--${pack.planVariant} ${isActivePlan ? 'royalty-plan-current' : ''}">
                        <div class="royalty-package-card-header">
                            <div class="royalty-package-title-block">
                                <h3 class="royalty-package-tier-name">${pack.tier}</h3>
                                <p class="royalty-badge-title-grant">Badge title: <strong>${pack.badgeTitleGranted}</strong></p>
                            </div>
                            <span class="${badgeClass}">${pack.badge}</span>
                        </div>
                        <div class="royalty-package-cost">${pack.cost}</div>
                        <ul class="royalty-package-features-list">
                            ${pack.features.map((feat) => `
                                <li class="royalty-package-feature-item"><span class="royalty-package-feature-bullet" aria-hidden="true">✦</span><span>${feat}</span></li>
                            `).join('')}
                        </ul>
                        <div class="royalty-package-action-footer">
                            <button type="button" class="settings-btn master-action-btn royalty-package-action-btn ${buttonClass}"
                                    ${canSubscribe ? actionHandler : 'disabled'}>
                                ${buttonLabel}
                            </button>
                        </div>
                    </article>
                `;
                }).join('')}
                </div>
            </div>
        </div>
    `;
}


/* ==========================================================================
   SECTION 7: UNSEALED ACCOUNT RECORD DISCOVERIES ARCHIVE
   ========================================================================== */

/* Block 17: DISCOVERIES ARCHIVE REPOSITORY LEDGER COMPILER */
const playerAccountDiscoveriesDatabase = {
    nations: [
        { id: "vaelior", name: "Kingdom of Vaelior", excerpt: "Hailed far and wide as the radiant shield of the high crest valleys...", unlocked: true },
        { id: "aesthene", name: "Sovereignty of Aesthene", excerpt: "A realm carved from glacier shelves, where frozen spires channel ancient frost arcs...", unlocked: true }
    ]
};

const CHRONICLE_BASIC_TIER_REWARDS = [
    { rank: 5, title: 'Scout\'s Crest Frame', reward: 'Profile avatar border — bronze filigree', state: 'locked' },
    { rank: 10, title: 'Quartermaster Stipend', reward: '+5% provision cap while enrolled in an Age', state: 'locked' },
    { rank: 15, title: 'War Table Emote Pack I', reward: 'Three commander salute animations for chat', state: 'locked' },
    { rank: 18, title: 'Campaign Pennant', reward: 'Nation-colored pennant on your public profile card', state: 'locked' },
    { rank: 22, title: 'Lord-High Commendation', reward: 'Exclusive title flair and silver nameplate trim', state: 'locked' }
];

const CHRONICLE_PREMIUM_TIER_REWARDS = [
    { rank: 5, title: 'Gilded Chronicle Frame', reward: 'Animated gold avatar border for your commander dossier', state: 'locked' },
    { rank: 10, title: 'Royal Courier Slots', reward: '+3 extra recipients per outbound message while subscribed', state: 'locked' },
    { rank: 15, title: 'Premium War Table Emotes', reward: 'Six exclusive salute and victory animations for chat', state: 'locked' },
    { rank: 18, title: 'Sovereign Banner Overlay', reward: 'Animated nation banner backdrop on your profile', state: 'locked' },
    { rank: 22, title: 'Crownwright\'s Laurels', reward: 'Golden nameplate glow, crown flair, and premium chat badge', state: 'locked' }
];

let activeChronicleRewardsTrack = 'basic';

function getCommanderChronicleRankSnapshot() {
    const currentRank = typeof player !== 'undefined' && Number.isFinite(player.rank) ? player.rank : 1;
    const nextRankXp = typeof xpRequirements !== 'undefined' ? (xpRequirements[currentRank] || 90) : 90;
    const groundTitle = typeof groundTitles !== 'undefined' && groundTitles[currentRank - 1]
        ? groundTitles[currentRank - 1]
        : 'Vintenary';
    return { currentRank, nextRankXp, groundTitle };
}

function isChronicleRewardUnlocked(entry, trackKey) {
    const { currentRank } = getCommanderChronicleRankSnapshot();
    const rankMet = currentRank >= entry.rank;
    if (trackKey === 'premium') {
        return isCommanderRoyaltyMember() && rankMet && entry.state === 'unlocked';
    }
    return rankMet && entry.state === 'unlocked';
}

function buildChronicleMilestoneCardMarkup(entry, trackKey) {
    const unlocked = isChronicleRewardUnlocked(entry, trackKey);
    const premiumLocked = trackKey === 'premium' && !isCommanderRoyaltyMember();
    const statusLabel = unlocked
        ? 'Claimed'
        : (premiumLocked ? 'Royalty' : 'Locked');
    const statusClass = unlocked
        ? 'status-unlocked-text-tag'
        : (premiumLocked ? 'status-premium-required-tag' : 'status-locked-text-tag');

    return `
        <div class="milestone-landmark-capsule-card ${unlocked ? 'landmark-node-unlocked' : 'landmark-node-locked'} ${premiumLocked ? 'landmark-node-premium-gated' : ''}">
            <span class="milestone-badge-hexagon-icon" aria-hidden="true">${trackKey === 'premium' ? '👑' : '✦'}</span>
            <div class="milestone-meta-contents">
                <span class="milestone-tier-level-label">Rank ${entry.rank}${trackKey === 'premium' ? ' · Premium track' : ''}</span>
                <span class="milestone-title-string">${entry.title}</span>
                <p class="milestone-reward-description-text">${entry.reward}</p>
                ${premiumLocked ? `<p class="milestone-premium-hint">Requires <strong>Royalty</strong> membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}) — unlock on the Royalty page.</p>` : ''}
            </div>
            <span class="milestone-status-action-deck ${statusClass}">${statusLabel}</span>
        </div>
    `;
}

function buildChronicleRewardsTrackMarkup(trackKey) {
    const list = trackKey === 'premium' ? CHRONICLE_PREMIUM_TIER_REWARDS : CHRONICLE_BASIC_TIER_REWARDS;
    return list.map((entry) => buildChronicleMilestoneCardMarkup(entry, trackKey)).join('');
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

function renderChroniclesProgressMatrixCanvas(viewport) {
    const { currentRank, nextRankXp, groundTitle } = getCommanderChronicleRankSnapshot();
    const isRoyalty = isCommanderRoyaltyMember();

    viewport.innerHTML = `
        <div class="chronicles-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">📜 Chronicle Tier Rewards</h2>
                <p class="royalty-master-subtitle">Earn XP in Ages to climb ranks and unlock rewards. <strong>Basic Tier</strong> is free for every commander. <strong>Premium Tier</strong> unlocks when you subscribe on the <strong>Royalty</strong> page and earn the Royalty badge (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}). This is not the development Roadmap.</p>
            </header>
            <div class="chronicles-master-card-box">
                <div class="chronicles-level-header-row">
                    <span class="chronicles-main-rank-readout">Rank ${currentRank} — ${groundTitle}</span>
                    <span class="chronicles-xp-fraction-tag">0 / ${nextRankXp} XP to next rank</span>
                </div>
                <div class="chronicles-progress-bar-track-bezel" aria-hidden="true">
                    <div class="chronicles-progress-bar-fill-glow" style="width: 4%;"></div>
                </div>
            </div>
            <nav class="chronicle-rewards-track-tab-bar" aria-label="Chronicle reward tiers">
                <button type="button" class="chronicle-rewards-track-tab ${activeChronicleRewardsTrack === 'basic' ? 'active' : ''}" data-chronicle-track="basic" onclick="activateChronicleRewardsTrack('basic', event)">
                    <span class="chronicle-track-tab-title">Basic Tier Rewards</span>
                    <span class="chronicle-track-tab-badge chronicle-track-tab-badge-free">FREE</span>
                </button>
                <button type="button" class="chronicle-rewards-track-tab ${activeChronicleRewardsTrack === 'premium' ? 'active' : ''}" data-chronicle-track="premium" onclick="activateChronicleRewardsTrack('premium', event)">
                    <span class="chronicle-track-tab-title">Premium Tier Rewards</span>
                    <span class="chronicle-track-tab-badge chronicle-track-tab-badge-premium">$10/mo</span>
                </button>
            </nav>
            <div id="chronicle-premium-upsell-banner" class="chronicle-premium-upsell-banner" ${isRoyalty ? 'hidden' : ''}>
                <div class="chronicle-premium-upsell-copy">
                    <strong>Premium Tier Rewards</strong> unlock with <strong>Royalty</strong> membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}). Subscribers receive the Royalty badge title on their profile.
                </div>
                <button type="button" class="settings-btn chronicle-premium-upsell-btn pulse-buy-btn" onclick="openUnlockPremiumTierPortal(event)">Unlock Premium Tier</button>
            </div>
            <div class="chronicle-rewards-tracks-deck">
                <section class="chronicle-rewards-track-panel chronicle-rewards-track-panel-active" data-chronicle-track-panel="basic" id="chronicle-panel-basic">
                    <h3 class="chronicles-grid-heading-label">Basic Tier — included for all commanders</h3>
                    <div class="chronicles-milestones-grid-layout" id="chronicle-rewards-track-basic"></div>
                </section>
                <section class="chronicle-rewards-track-panel chronicle-rewards-track-panel-hidden" data-chronicle-track-panel="premium" id="chronicle-panel-premium">
                    <div class="chronicle-premium-panel-header">
                        <h3 class="chronicles-grid-heading-label">Premium Tier — Royalty members (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL})</h3>
                        ${isRoyalty ? '' : `<button type="button" class="settings-btn chronicle-premium-panel-unlock-btn" onclick="openUnlockPremiumTierPortal(event)">Unlock Premium Tier</button>`}
                    </div>
                    <div class="chronicles-milestones-grid-layout" id="chronicle-rewards-track-premium"></div>
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
window.beginRoyaltyMembershipCheckout = beginRoyaltyMembershipCheckout;

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
                    'Dedicated portal home with sticky top navigation: Age Portal, Leaderboards, Community Chat, Discoveries, Royalty, Chronicle Tier Rewards, and this Evolution Roadmap.',
                    'Live Age metrics strip: cycle label, game mode, Great Transition countdown, leading nation, registered and active player rosters.',
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
                    'Unlock Discoveries archive with full nation lore playback and unlock progression.',
                    'Activate Chronicle Tier Rewards claim flow tied to live rank XP from Ages.',
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
        summary: 'The evolutionary leap from portal-only to a real Age round: map presence, unit actions, and shared battle state so testers can fight, earn XP, and climb the Chronicle tier track.',
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
                    <p class="evolution-roadmap-lead">From pre-alpha concept through today\'s Age Portal build to the first playable Alpha 2.0 Age. This is the development timeline — not the in-game Chronicle tier reward track (see <strong>The Chronicles</strong> tab).</p>
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

function renderMasterDiscoveriesPortalCanvas(viewport) {
    viewport.innerHTML = `
        <div class="discoveries-workspace-chassis">
            <div class="discoveries-sidebar-filters-deck">
                <button class="chat-channel-btn active-channel-glow">🚩 Nations</button>
            </div>
            <div class="discoveries-main-scroll-track">
                ${playerAccountDiscoveriesDatabase.nations.map(entry => `
                    <div class="discovery-archive-ledger-card ledger-node-unlocked">
                        <div class="discovery-card-header-row">
                            <span class="discovery-card-name-title">👑 ${entry.name}</span>
                            <span class="discovery-card-badge-tag tag-unlocked">UNLOCKED</span>
                        </div>
                        <p class="discovery-card-body-excerpt-text">"${entry.excerpt}"</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
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
    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return 0;

    const gain = resolvePortalBackgroundMusicGain();
    bgMusic.volume = gain;

    const muteBtnIcon = document.getElementById('media-mute-symbol-node');
    const volumeSlider = document.getElementById('media-volume-slider-input');
    const userMutedViaDeck = muteBtnIcon && muteBtnIcon.innerText === '🔇';

    if (userMutedViaDeck) {
        bgMusic.muted = true;
    } else if (gain > 0) {
        bgMusic.muted = false;
        if (muteBtnIcon) muteBtnIcon.innerText = gain < 0.4 ? '🔉' : '🔊';
        if (volumeSlider) volumeSlider.value = gain;
    } else {
        bgMusic.muted = true;
        if (muteBtnIcon) muteBtnIcon.innerText = '🔇';
        if (volumeSlider) volumeSlider.value = 0;
    }

    return gain;
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
let currentPortalNarrationVol = parseFloat(localStorage.getItem('savedNarrationVol')) ?? 0.7;
let currentPortalSfxVol = parseFloat(localStorage.getItem('savedSfxVol')) ?? 0.4;

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
    deploymentHousings.forEach(bindJoinAgeDeploymentButtonHover);
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
    { title: "🎵 THE CHRONICLES OF AMNEK", file: "audio/archimedeslullaby.wav" }, // Re-using track asset for demonstration maps
    { title: "🎵 THE ARCHON DESCENT", file: "audio/archimedeslullaby.wav" }
];

let currentTrackIndexMarker = 0;
let isShuffleModeActive = false;
let isRepeatModeActive = false;

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
        if (isRepeatModeActive) {
            bgAudio.currentTime = 0;
            bgAudio.play().catch(() => {});
        } else {
            executeTrackNavigationSkip('next');
        }
    });

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

window.executeTrackNavigationSkip = function(directionType) {
    const bgAudio = document.getElementById('portal-background-theme-audio');
    const trackLabel = document.getElementById('media-active-track-name');
    
    if (!bgAudio || !trackLabel) return;

    if (isShuffleModeActive && directionType === 'next') {
        currentTrackIndexMarker = Math.floor(Math.random() * royalArmiesPlaylistRepository.length);
    } else {
        if (directionType === 'next') {
            currentTrackIndexMarker = (currentTrackIndexMarker + 1) % royalArmiesPlaylistRepository.length;
        } else {
            currentTrackIndexMarker = (currentTrackIndexMarker - 1 + royalArmiesPlaylistRepository.length) % royalArmiesPlaylistRepository.length;
        }
    }

    const targetedTrackSourceAsset = royalArmiesPlaylistRepository[currentTrackIndexMarker];
    trackLabel.innerText = targetedTrackSourceAsset.title;

    // Swap physical soundtrack audio file mapping channels inside the source injector element
    const sourceNode = bgAudio.querySelector('source');
    if (sourceNode) sourceNode.src = targetedTrackSourceAsset.file;
    
    bgAudio.load();
    bgAudio.addEventListener('loadedmetadata', () => syncMediaPlayerTimelineUI(bgAudio), { once: true });
    startPortalBackgroundMusic({ silentFail: true });
};

window.togglePlaylistShuffleState = function() {
    isShuffleModeActive = !isShuffleModeActive;
    const btn = document.getElementById('media-shuffle-toggle');
    if (btn) btn.classList.toggle('utility-active-glow', isShuffleModeActive);
};

window.togglePlaylistRepeatState = function() {
    isRepeatModeActive = !isRepeatModeActive;
    const btn = document.getElementById('media-repeat-toggle');
    if (btn) btn.classList.toggle('utility-active-glow', isRepeatModeActive);
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
    if (getPortalBackgroundAudioElement()?.paused) {
        startPortalBackgroundMusic({ silentFail: true });
    }
};

window.startPortalBackgroundMusic = startPortalBackgroundMusic;
window.applyPortalBackgroundMusicVolume = applyPortalBackgroundMusicVolume;
window.hydratePortalVolumeStateFromStorage = hydratePortalVolumeStateFromStorage;
window.triggerMainDashboardLogout = triggerMainDashboardLogout;
window.closeMainLogoutConfirmationWindow = closeMainLogoutConfirmationWindow;
window.executeLogoutRedirect = executeLogoutRedirect;
window.notifyPortalAgeSessionLeave = notifyPortalAgeSessionLeave;
window.notifyPortalAgeSessionJoin = notifyPortalAgeSessionJoin;
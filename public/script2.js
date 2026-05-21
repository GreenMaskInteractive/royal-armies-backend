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

    return notifyPortalAgeSessionLeave().catch(() => {});
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
let portalLiveMetricsCache = {
    registeredCount: 0,
    recentRegistrations: [],
    ageOnlineCount: 0,
    agePlayingCount: 0,
    ageOnlinePlayers: [],
    agePlayingPlayers: []
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

    portalLiveMetricsCache = {
        registeredCount,
        recentRegistrations,
        ageOnlineCount,
        agePlayingCount,
        ageOnlinePlayers,
        agePlayingPlayers: Array.isArray(metrics?.agePlayingPlayers) ? metrics.agePlayingPlayers : []
    };

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
            agePlayingPlayers: []
        });
    }
}

async function sendPortalPresenceHeartbeat() {
    const username = resolvePortalPresenceUsername();
    if (!username) return;

    try {
        await fetch('/api/portal/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                inAge: isCommanderPlayingActiveAgeLocally()
            })
        });
    } catch (err) {
        console.warn('Portal presence heartbeat failed:', err);
    }
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

    if (portalMetricsPollTimer) clearInterval(portalMetricsPollTimer);
    portalMetricsPollTimer = setInterval(fetchPortalLiveMetrics, 15000);

    if (portalPresenceHeartbeatTimer) clearInterval(portalPresenceHeartbeatTimer);
    portalPresenceHeartbeatTimer = setInterval(() => {
        sendPortalPresenceHeartbeat().then(fetchPortalLiveMetrics);
    }, 60000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sendPortalPresenceHeartbeat();
            fetchPortalLiveMetrics();
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
    const activeRealUser = localStorage.getItem('activeCommanderUser') || 'testaccount';
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
            <aside class="chat-sidebar-player-roster-deck">
                <div class="player-roster-header-title">👥 In Channel</div>
                <div class="player-roster-scrollable-track-bin">
                    <div class="roster-commander-node-row status-online"><span class="status-dot">●</span> ${activeRealUser} (You)</div>
                </div>
            </aside>
        </div>
    `;
    executeCompileActiveChannelMessageStrips();
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
 if (log.sender === "Moderator") messageRow.classList.add('system-bot-message-highlight');

 let formattedTextContent = log.text.replace(/(@[a-zA-Z0-9_\-]+)/g, '<span class="chat-shoutout-mention-badge">$1</span>');
 messageRow.innerHTML = `
 <div class="chat-message-meta-left">
 <span class="chat-message-timestamp">[${log.time}]</span>
 <span class="chat-message-sender-name"><strong>${log.sender}:</strong></span>
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
    sender: "Moderator",
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
   SECTION 6: STAGING ROYALTY REWARD MEMBERSHIPS
   ========================================================================== */

/* Block 15: PREMIUM ROYALS MEMBERSHIP CONFIGURATION DATA */
const globalRoyaltyTierPackagesDatabase = [
    {
        tier: "Standard",
        cost: "Free",
        glowClass: "standard-package-border",
        badge: "FREE",
        features: [
            "Access to standard Ages",
            "Default message recipient limits",
            "Standard resource production rates",
            "Basic profile customization"
        ],
        actionText: "Current plan",
        enabled: false
    },
    {
        tier: "Premium",
        cost: "Paid membership",
        glowClass: "vanguard-package-glow",
        badge: "PREMIUM",
        features: [
            "Priority queue when servers are busy",
            "Send messages to more recipients at once",
            "+15% resource generation bonus",
            "Exclusive gold profile frame cosmetics"
        ],
        actionText: "Upgrade",
        enabled: true
    }
];

/* Block 16: ROYALTY MATRIX PORTAL ROUTER INTERCEPT ENGINE */
function renderRoyaltyTierPortalCanvas(viewport) {
    viewport.innerHTML = `
        <div class="royalty-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">👑 Membership</h2>
                <p class="royalty-master-subtitle">Support the game to unlock premium perks, resource bonuses, and exclusive cosmetics.</p>
            </header>
            <div class="royalty-tier-cards-flex-row">
                ${globalRoyaltyTierPackagesDatabase.map(pack => `
                    <div class="royalty-package-display-card ${pack.glowClass}">
                        <div class="package-header-row-block">
                            <span class="package-tier-name-title">${pack.tier}</span>
                            <span class="package-tier-badge-label">${pack.badge}</span>
                        </div>
                        <div class="package-cost-numerical-display">${pack.cost}</div>
                        <ul class="package-features-bullet-list">
                            ${pack.features.map(feat => `
                                <li><span class="medieval-bullet-bullet">✦</span> ${feat}</li>
                            `).join('')}
                        </ul>
                        <div class="package-action-footer-deck">
                            <button class="settings-btn master-action-btn ${pack.enabled ? 'pulse-buy-btn' : 'disabled-active-btn'}" 
                                    ${pack.enabled ? `onclick="alert('Premium checkout for ${pack.tier} is not available yet.')"` : 'disabled'}>
                                ${pack.actionText}
                            </button>
                        </div>
                    </div>
                `).join('')}
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

function renderChroniclesProgressMatrixCanvas(viewport) {
    viewport.innerHTML = `
        <div class="dashboard-news-card-box" style="width: 100% !important; max-width: 100% !important;">
            <h2 class="card-title-header">📜 The Chronicles</h2>
            <div class="card-scrollable-body-text">
                <p style="margin-bottom: 16px; color: #f1e0ac;">
                    This page will show the history of each Age, major alliances, and world events across Amnek.
                    The interactive timeline is coming in a future update.
                </p>
                <p style="color: rgba(241,224,172,0.55); font-size: 0.85rem; margin: 0;">
                    History feeds for this section are still being built.
                </p>
            </div>
        </div>
    `;
}

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
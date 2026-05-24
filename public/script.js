/**
 * script.js - Royal Armies
 * The RAGE (Royal Armies Game Engine) Framework
 * Primary Logic Controller for the AVI Interface
 */

/* ==========================================
   RAGE MODULE: GLOBAL BRIDGE & FORWARD DECLARATIONS
   ========================================== */

/* --- Section: Cross-Module Function Hoists --- */ 
var handleLogin; 
var selectClass; 
var confirmSelection; 

/* ==========================================
   RAGE MODULE: GLOBAL STATE & SAFETY NETS
   ========================================== */

/* --- Section: Engine State Registers --- */ 
if (typeof groundRanks === 'undefined') { 
    var groundRanks = { 
        "1": { title: "Recruit", max_slots: 100 }, 
        "2": { title: "Soldier", max_slots: 200 } 
    }; 
} 

let selectedClassId = null; 
let narrativeFinished = false; 

/* Block 1: Master System Settings State Registers */
let currentNarration = null; // Managed audio tracker channel slot 
let globalBackgroundMusic = null; // THE TRACKING HOOK: Locks onto your ambient soundtrack 
let confirmedScale = parseFloat(localStorage.getItem('savedUIScale')) || 1.0; 
let stagedScale = confirmedScale;
const TEXT_SCALE_MIN = 0.75;
const TEXT_SCALE_MAX = 1.5;
const TEXT_SCALE_BASE_PX = 16;
let confirmedTextScale = parseFloat(localStorage.getItem('savedTextScale')) || 1.0;
let stagedTextScale = confirmedTextScale;
let hasUnsavedChanges = false; // System safety guard toggle
const appRuntimeGlobal = typeof globalThis !== 'undefined' ? globalThis : window;
let profileEditorBaseline = null; 
let saveConfirmationHideTimer = null;

// Master Audio System Channels 
let confirmedMasterVol = parseFloat(localStorage.getItem('savedMasterVol')) || 1.0; 
let confirmedMusicVol = parseFloat(localStorage.getItem('savedMusicVol')) || 0.5; // NEW: Stored background music value register 
let confirmedNarrationVol = parseFloat(localStorage.getItem('savedNarrationVol')) || 1; 
let confirmedSfxVol = parseFloat(localStorage.getItem('savedSfxVol')) || 0.2; 
let stagedMasterVol = confirmedMasterVol; 
let stagedMusicVol = confirmedMusicVol; // NEW: Staged background music temporary register 
let stagedNarrationVol = confirmedNarrationVol; 
let stagedSfxVol = confirmedSfxVol; 

// Master Gameplay Strategic Filters 
let confirmedVerbosity = localStorage.getItem('savedVerbosity') || "Detailed"; 
let confirmedPings = localStorage.getItem('savedPings') || "Enabled"; 
let confirmedSafetyLock = localStorage.getItem('savedSafetyLock') || "Double-Click"; 
let stagedVerbosity = confirmedVerbosity; 
let stagedPings = confirmedPings; 
let stagedSafetyLock = confirmedSafetyLock; 

let confirmedGameChatOpacity = Math.max(15, Math.min(100, parseFloat(localStorage.getItem('savedGameChatOpacity')) || 85));
let stagedGameChatOpacity = confirmedGameChatOpacity;

// RUN INSTANTLY ON BOOT: Sync visual styles (skip landing index — uses landing-login.css)
if (document.getElementById('page-landing')) {
    document.documentElement.style.setProperty('--text-scale', String(confirmedTextScale));
} else {
    document.documentElement.style.setProperty('--ui-scale', confirmedScale);
    applyTextScaleToDocument(confirmedTextScale, { silent: true });
}
if (localStorage.getItem('savedHighContrast') === 'true') { 
    document.body.classList.add('high-contrast-mode'); 
}

function isDyslexiaFontEnabled() {
    return document.documentElement.classList.contains('dyslexia-font-enabled');
}

function setDyslexiaFontEnabled(enabled) {
    document.documentElement.classList.toggle('dyslexia-font-enabled', enabled);

    const fontCheck = document.getElementById('font-toggle-check');
    if (fontCheck) fontCheck.checked = enabled;

    let detailsBody = null;
    if (typeof getActiveSettingsBodyElement === 'function') {
        detailsBody = getActiveSettingsBodyElement();
    }
    if (!detailsBody) {
        detailsBody = document.getElementById('portal-commander-hub-body')
            || document.getElementById('commander-hub-body')
            || document.getElementById('lore-details-body');
    }
    if (detailsBody) {
        detailsBody.classList.toggle('dyslexia-font', enabled);
    }
}

function applyDyslexiaFontPreferenceFromStorage() {
    setDyslexiaFontEnabled(localStorage.getItem('savedDyslexiaFont') === 'true');
}

applyDyslexiaFontPreferenceFromStorage();

/* --- Section: Messaging Hub Data Backplanes --- */
let selectedRecipients = [];
let savedMessageDrafts = [];

// Legacy address book placeholder (unused — recipient lists use globalFactionServerDirectory)
const allianceAddressBook = {
    country: [],
    allies: {},
    other: []
};

/* --- Section: Player Profile & Penalty Catalog --- */

function getActiveCommanderUsername() {
    const saved = localStorage.getItem('activeCommanderUser');
    if (saved && saved.trim() !== '') return saved.trim();
    if (document.getElementById('main-dashboard-canvas')) return '';
    return 'testaccount';
}

function isMainPortalHub() {
    return !!document.getElementById('main-dashboard-canvas');
}

const PORTAL_AUTH_STORAGE_KEY = 'royalArmiesPortalAuth';
const PORTAL_AUTH_RESTORE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
let portalAuthRestorePromise = null;

function persistPortalAuth(username, rememberMe = true) {
    const user = String(username || '').trim();
    if (!user) return;
    localStorage.setItem('activeCommanderUser', user);
    localStorage.setItem(PORTAL_AUTH_STORAGE_KEY, JSON.stringify({
        username: user,
        rememberMe: rememberMe !== false,
        savedAt: Date.now()
    }));
}

function clearPortalAuthStorage() {
    localStorage.removeItem('activeCommanderUser');
    localStorage.removeItem(PORTAL_AUTH_STORAGE_KEY);
}

function restorePortalAuthFromLocalBundle() {
    const raw = localStorage.getItem(PORTAL_AUTH_STORAGE_KEY);
    if (!raw) return '';
    try {
        const bundle = JSON.parse(raw);
        const user = String(bundle.username || '').trim();
        if (!user) return '';
        if (bundle.rememberMe === false) return '';
        const savedAt = Number(bundle.savedAt) || 0;
        if (savedAt && (Date.now() - savedAt) > PORTAL_AUTH_RESTORE_MAX_AGE_MS) {
            clearPortalAuthStorage();
            return '';
        }
        localStorage.setItem('activeCommanderUser', user);
        return user;
    } catch (_err) {
        return '';
    }
}

function shouldUsePortalSessionCookies() {
    return typeof isLandingServedByNexusBackend === 'function' && isLandingServedByNexusBackend();
}

function canUsePortalAuthSessionApi() {
    if (shouldUsePortalSessionCookies()) return true;
    return typeof isMailboxApiAvailable === 'function' && isMailboxApiAvailable();
}

function resolvePortalLoginRememberMe() {
    const checkbox = document.getElementById('login-remember-me');
    if (checkbox) return checkbox.checked;
    return shouldUsePortalSessionCookies();
}

async function bootstrapLocalDevPortalSession(mode) {
    const playerMode = mode === 'player';
    const devUser = playerMode
        ? String((typeof LOCAL_DEV_PLAYER_BYPASS_USERNAME === 'string' && LOCAL_DEV_PLAYER_BYPASS_USERNAME) || 'DevPlayer').trim()
        : String((typeof LOCAL_DEV_AUTO_LOGIN_USERNAME === 'string' && LOCAL_DEV_AUTO_LOGIN_USERNAME) || 'caleb_admin').trim();

    persistPortalAuth(devUser, true);
    if (typeof player !== 'undefined') player.name = devUser;

    if (canUsePortalAuthSessionApi()) {
        try {
            await fetch(
                typeof resolveRoyalArmiesApiUrl === 'function'
                    ? resolveRoyalArmiesApiUrl('/api/auth/dev-session')
                    : '/api/auth/dev-session',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    cache: 'no-store',
                    body: JSON.stringify({ mode: playerMode ? 'player' : 'owner' })
                }
            );
        } catch (_err) {
            /* UI auth still works client-side on port 3000 */
        }
    }

    return devUser;
}

async function applyLocalDevAutoLogin() {
    if (typeof isLocalDevAutoLoginEnabled !== 'function' || !isLocalDevAutoLoginEnabled()) {
        return '';
    }
    if (typeof shouldSkipLocalDevAutoLogin === 'function' && shouldSkipLocalDevAutoLogin()) {
        return '';
    }
    return bootstrapLocalDevPortalSession('owner');
}

async function applyLocalDevPlayerBypassLogin() {
    if (typeof isLocalDevAutoLoginEnabled !== 'function' || !isLocalDevAutoLoginEnabled()) {
        return '';
    }
    if (typeof shouldSkipLocalDevAutoLogin === 'function' && shouldSkipLocalDevAutoLogin()) {
        return '';
    }
    return bootstrapLocalDevPortalSession('player');
}

async function restorePortalAuthSession() {
    if (typeof isLocalDevAutoLoginEnabled === 'function' && isLocalDevAutoLoginEnabled()) {
        if (typeof getLocalDevViewMode === 'function' && getLocalDevViewMode() === 'guest') {
            clearPortalAuthStorage();
            return '';
        }
        if (typeof shouldSkipLocalDevAutoLogin !== 'function' || !shouldSkipLocalDevAutoLogin()) {
            const viewMode = typeof getLocalDevViewMode === 'function' ? getLocalDevViewMode() : 'owner';
            if (viewMode === 'player') {
                return applyLocalDevPlayerBypassLogin();
            }
            return applyLocalDevAutoLogin();
        }
    }

    let username = String(localStorage.getItem('activeCommanderUser') || '').trim();
    if (!username) {
        username = restorePortalAuthFromLocalBundle();
    }

    if (username) {
        if (typeof player !== 'undefined') player.name = username;
        return username;
    }

    if (canUsePortalAuthSessionApi()) {
        try {
            const response = await fetch(
                typeof resolveRoyalArmiesApiUrl === 'function'
                    ? resolveRoyalArmiesApiUrl('/api/auth/session')
                    : '/api/auth/session',
                {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store'
                }
            );
            if (response.ok) {
                const payload = await response.json().catch(() => ({}));
                if (payload.authenticated && payload.username) {
                    persistPortalAuth(payload.username, true);
                    if (typeof player !== 'undefined') player.name = payload.username;
                    return String(payload.username).trim();
                }
            }
        } catch (_err) {
            /* session unavailable */
        }
    }

    return '';
}

function ensurePortalAuthRestored() {
    if (!portalAuthRestorePromise) {
        portalAuthRestorePromise = restorePortalAuthSession();
    }
    return portalAuthRestorePromise;
}

function isPortalUserAuthenticated() {
    const saved = localStorage.getItem('activeCommanderUser');
    return !!(saved && saved.trim() !== '');
}

function bindPortalAuthActionControls() {
    if (!isMainPortalHub()) return;

    const controls = [
        document.getElementById('portal-desktop-login-btn'),
        document.getElementById('portal-mobile-guest-login-btn')
    ].filter(Boolean);

    controls.forEach((btn) => {
        if (btn.dataset.boundPortalAuthAction === 'true') return;
        btn.dataset.boundPortalAuthAction = 'true';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof closePortalMobileNavMenus === 'function') {
                closePortalMobileNavMenus();
            }
            handleHeaderAuthAction();
        });
    });
}

function refreshMainPortalAuthChrome() {
    if (!isMainPortalHub()) return;

    bindPortalAuthActionControls();

    const desktopGuestCard = document.getElementById('portal-desktop-guest-auth-card');
    const desktopMemberCluster = document.getElementById('portal-desktop-member-auth-cluster');
    const mobileGuestLoginBlock = document.getElementById('portal-mobile-guest-login-block');
    const mobileCommanderBlock = document.getElementById('portal-mobile-commander-block');
    const mobileNavAuthBtn = document.getElementById('portal-mobile-nav-auth-btn');
    const metricsBtn = document.getElementById('metrics-auth-action-btn');
    const authed = isPortalUserAuthenticated();

    if (desktopGuestCard) desktopGuestCard.hidden = authed;
    if (desktopMemberCluster) desktopMemberCluster.hidden = !authed;
    if (mobileGuestLoginBlock) mobileGuestLoginBlock.hidden = authed;
    if (mobileCommanderBlock) mobileCommanderBlock.hidden = !authed;
    if (mobileNavAuthBtn) mobileNavAuthBtn.hidden = true;
    if (metricsBtn) metricsBtn.hidden = true;

    if (typeof refreshLoggedUserTagDisplay === 'function') {
        refreshLoggedUserTagDisplay();
    }

    if (typeof applyPortalNavAccessRestrictions === 'function') {
        applyPortalNavAccessRestrictions();
    } else if (typeof applyPortalGuestDeploymentChrome === 'function') {
        applyPortalGuestDeploymentChrome();
    }

    if (typeof syncPortalMobileNavIdentity === 'function') {
        syncPortalMobileNavIdentity();
    }

    if (typeof applyProfileRankResetButtonState === 'function') {
        applyProfileRankResetButtonState();
    }

    if (typeof applyPortalMobileVisualSettingsRestrictions === 'function') {
        applyPortalMobileVisualSettingsRestrictions();
    }
}

function openMainPortalGuestRegister(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (typeof handleRegister === 'function') {
        handleRegister();
    }
}

function handleHeaderAuthAction() {
    if (!isMainPortalHub()) return;
    if (isPortalUserAuthenticated()) {
        if (typeof triggerMainDashboardLogout === 'function') {
            triggerMainDashboardLogout();
        }
        return;
    }
    openMainPortalLoginModal();
}

function openMainPortalLoginModal() {
    const modal = document.getElementById('main-portal-login-modal');
    if (!modal) return;

    closeRegister();
    closeForgot();

    const rememberCheckbox = document.getElementById('login-remember-me');
    if (rememberCheckbox) {
        rememberCheckbox.checked = shouldUsePortalSessionCookies() || rememberCheckbox.checked;
    }

    modal.classList.remove('main-portal-modal-hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.setAttribute('aria-hidden', 'false');

    const userField = document.getElementById('login-username');
    if (userField) {
        setTimeout(() => userField.focus(), 50);
    }

    if (!modal.dataset.boundBackdropClose) {
        modal.dataset.boundBackdropClose = 'true';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeMainPortalLoginModal();
        });
    }
}

function closeMainPortalLoginModal() {
    const modal = document.getElementById('main-portal-login-modal');
    if (!modal) return;
    modal.style.setProperty('display', 'none', 'important');
    modal.classList.add('main-portal-modal-hidden');
    modal.setAttribute('aria-hidden', 'true');
    restoreLoginAuthButtons();
}

function hydratePlayerPublicDossierFromStorage() {
    if (typeof player === 'undefined') return;
    if (typeof hydrateCommanderDossierFromLocalCache === 'function') {
        hydrateCommanderDossierFromLocalCache();
        if (!Array.isArray(player.ageHistory)) player.ageHistory = [];
        if (!Array.isArray(player.awards)) player.awards = [];
        if (!Array.isArray(player.medals)) player.medals = [];
        return;
    }
    const cachedProfile = readCommanderProfileFromLocalCache();
    player.description = cachedProfile.bio;
    player.privacy = cachedProfile.privacy;
    try {
        const ageCache = localStorage.getItem('savedCommanderAgeHistory');
        if (ageCache) player.ageHistory = JSON.parse(ageCache);
    } catch (err) {
        player.ageHistory = [];
    }
    try {
        const awardCache = localStorage.getItem('savedCommanderAwards');
        if (awardCache) player.awards = JSON.parse(awardCache);
    } catch (err) {
        player.awards = [];
    }
    try {
        const medalCache = localStorage.getItem('savedCommanderMedals');
        if (medalCache) player.medals = JSON.parse(medalCache);
    } catch (err) {
        player.medals = [];
    }
    if (!Array.isArray(player.ageHistory)) player.ageHistory = [];
    if (!Array.isArray(player.awards)) player.awards = [];
    if (!Array.isArray(player.medals)) player.medals = [];
}

function syncPlayerFromActiveCommanderStorage() {
    if (typeof player === 'undefined') return;
    player.name = getActiveCommanderUsername();
    const savedAvatar = localStorage.getItem('savedProfileAvatarUrl');
    if (savedAvatar) player.avatarUrl = savedAvatar;
    hydratePlayerPublicDossierFromStorage();
    if (typeof hydrateCommanderMembershipFromStorage === 'function') {
        hydrateCommanderMembershipFromStorage();
    }
    loadCommanderMailboxDossiersFromStorage();
    if (typeof fetchCommanderDossierFromServer === 'function') {
        fetchCommanderDossierFromServer();
    } else if (typeof fetchCommanderProfileFromServer === 'function') {
        fetchCommanderProfileFromServer();
    }
    fetchCommanderMailboxFromServer().finally(() => {
        if (typeof startPortalMailboxPolling === 'function') startPortalMailboxPolling();
    });
    refreshProfileCommanderNameDisplay();
    refreshLoggedUserTagDisplay();
    syncNavMailboxIndicators();
}

function refreshProfileCommanderNameDisplay() {
    const displayName = getActiveCommanderUsername();
    if (typeof player !== 'undefined') player.name = displayName;
    document.querySelectorAll('.profile-main-name').forEach((el) => {
        el.textContent = displayName;
    });
}

function refreshLoggedUserTagDisplay() {
    const tag = document.getElementById('logged-user-tag');
    const mobileName = document.getElementById('portal-mobile-nav-username');
    const authed = isPortalUserAuthenticated();

    if (!authed && isMainPortalHub()) {
        if (tag) tag.textContent = '';
        if (mobileName) mobileName.textContent = '';
        return;
    }

    const name = getActiveCommanderUsername();
    const displayLabel = name || (isMainPortalHub() ? '' : 'Loading...');
    if (tag) tag.textContent = displayLabel;
    if (mobileName) mobileName.textContent = displayLabel;
}

var player = { 
    name: (() => {
        const saved = localStorage.getItem('activeCommanderUser');
        return saved && saved.trim() !== '' ? saved.trim() : 'testaccount';
    })(),
    rank: 1, 
    path: "PHYS", 
    gold: 1000, 
    xp: 0, 
    terrain: "Standard", 
    army: [], 
    
    // NEW PROFILE SUB-SYSTEM DATA PROPERTIES 
    country: "United Kingdom", 
    timezone: "GMT +1", 
    
    // THE CHOSEN FACTORY DEFAULT: Replaced placeholder asset path with default Commander emblem
    avatarUrl: "images/avatars/commanderprofile01.png", 
    
    membershipTitle: "Basic", 
    description: "Royal Armies player. Looking for allies and a good Age run.", 
    privacy: "Public", 
    
    // Social Node Arrays 
    friends: [],
    blocked: [],

    // Public dossier: ages served 24+ hours (newest first, max 5 shown on profile card)
    ageHistory: [],
    // Public dossier: { id, iconUrl?, label, achievement } — iconUrl optional until assets exist
    awards: [],
    // Public dossier: { id, iconUrl?, label, detail } — service / campaign medals
    medals: [],
    
    // Discipline Monitoring System (UPDATED EXTENSION COUPLING)
    // Seamlessly feeds exact properties into your live account verification popup loop!
    penalties: [
        { 
            type: "Chat Restrict", 
            expires: "2026-06-01", 
            severity: "Minor",
            icon: "images/penalties/mark_mute.png",
            desc: "Reason: Chat rule violations or spam. You cannot send chat messages while active."
        },
        { 
            type: "Grief Mark", 
            expires: "2026-07-15", 
            severity: "Moderate",
            icon: "images/penalties/mark_grief.png",
            desc: "Reason: Griefing allies, such as friendly fire or sabotaging shared resources."
        }
    ]
};

const globalPenaltyCatalog = {
    chat: {
        name: "Communication Restriction",
        icon: "images/penalties/mark_mute.png",
        desc: "Reason: Chat rule violations or spam. You cannot send chat messages while active."
    },
    grief: {
        name: "Griefing",
        icon: "images/penalties/mark_grief.png",
        desc: "Reason: Griefing allies, such as friendly fire or sabotaging shared resources."
    },
    exploit: {
        name: "Exploit abuse",
        icon: "images/penalties/mark_exploit.png",
        desc: "Reason: Abusing bugs, automation, or other unfair advantages."
    }
};

/* --- Section: Discipline Overlay Controllers --- */
function checkSystemLoginPenalties() { 
    // THE SYNCHRONIZED USERNAME FIX: 
    // Dynamically checks if the name belongs to 'testaccount' or if it matches your active variable name setup
    if (player.name !== "testaccount") { 
        console.log("Bypassing discipline reminder mask: Account does not match criteria."); 
        return; 
    } 
    
    const totalPenalties = player.penalties.length; 
    const overlay = document.getElementById('commander-penalty-overlay'); 
    const headerTitle = document.getElementById('penalty-popup-header-title'); 
    const textField = document.getElementById('penalty-popup-text-field'); 
    
    if (!overlay || !headerTitle || !textField) return; 
    
    // 1. Dynamic Grammatical Title Formatting 
    headerTitle.innerText = `Warning: You currently have ${totalPenalties} active penalties on your account. Please, do well to maintain a respectful and cooperative presence as well as a fair gameplay experience within the Royal Armies community.${totalPenalties === 1 ? '' : ''}`; 
    
    // 2. Clear out old rendering iterations inside our strike frame matrix cages 
    for (let i = 0; i < 3; i++) { 
        const cage = document.getElementById(`strike-cage-${i}`); 
        if (cage) { 
            cage.innerHTML = ""; 
            cage.className = "penalty-cage-slot"; // Reset structural rules 
            cage.removeAttribute('title'); // Wipe legacy hover attributes safely
        } 
    } 
    
    // 3. Map values across the 3 structural icon-shaped border slots 
    player.penalties.forEach((penalty, index) => { 
        if (index >= 3) return; // Hard capping to avoid matrix layout ruptures 
        
        const cage = document.getElementById(`strike-cage-${index}`); 
        if (cage) { 
            // Apply aggressive warning highlight colors to filled spaces 
            cage.classList.add('cage-slot-marked'); 
            
            // THE IMAGE HOVER AND SELECTION OVERRIDE:
            // Since the system images are empty placeholders right now, we inject a crisp, 
            // crimson text badge so the engine can run smoothly without asset errors!
            cage.innerHTML = `<span style="color: #cc0000; font-family: 'RoyalDetails', serif; font-size: 1.1rem; font-weight: bold; cursor: help;">[X]</span>`;
            
            // Inject the dynamic hover text layout descriptions explicitly onto the cage card wrapper
            cage.setAttribute('title', `${penalty.type.toUpperCase()}\n${penalty.desc}\nExpires: ${penalty.expires}`); 
        } 
    }); 
    
    // 4. Dynamic Risk Escalation Calculation 
    if (totalPenalties >= 3) { 
        textField.innerHTML = `<span style="color: #cc0000; font-weight: bold;">CRITICAL DISCIPLINE THRESHOLD VIOLATION:</span><br>Warning: You have penalties on your account. Please, do well to maintain a respectful and cooperative presence as well as a fair gameplay experience within the Royal Armies community.`; 
    } else { 
        textField.innerHTML = `This is a daily "Community Safety & Fairness" system reminder to keep players informed of their current discipline status. Accumulating 3 strikes will trigger a critical violation warning, and further infractions may lead to severe account restrictions. Please review the details of your active penalties and adjust your conduct accordingly to maintain good standing within Royal Armies.`; 
    } 
    
    // 5. Open the global canvas masking container layers smoothly via style engine class overrides
    overlay.classList.remove('suicide-overlay-hidden'); 
    overlay.style.setProperty('display', 'flex', 'important'); 
}

function closePenaltyOverlayWindow() {
    const overlay = document.getElementById('commander-relative-overlay') || document.getElementById('commander-penalty-overlay');
    if (overlay) {
        overlay.style.setProperty('display', 'none', 'important');
        overlay.classList.add('suicide-overlay-hidden');
    }
}

/* --- Section: Security Credentials Modification Engine --- */

const commanderSecurityProfileCache = { email: '', username: '', loaded: false };

function escapeSecurityFormHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function fetchCommanderSecurityProfile() {
    const username = getActiveCommanderUsername();
    commanderSecurityProfileCache.username = username;
    commanderSecurityProfileCache.email = '';
    commanderSecurityProfileCache.loaded = false;

    if (!username || username.toLowerCase() === 'testaccount') {
        return commanderSecurityProfileCache;
    }

    try {
        const response = await fetch(
            `/api/portal/account/security-profile?username=${encodeURIComponent(username)}`,
            { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.status === 'ok') {
            commanderSecurityProfileCache.email = payload.email || '';
            commanderSecurityProfileCache.loaded = true;
        }
    } catch (err) {
        console.warn('Could not load commander security profile:', err);
    }

    return commanderSecurityProfileCache;
}

function mountSecurityOverlayActions(primaryLabel, onPrimary, onCancel) {
    const btnDock = document.getElementById('security-popup-btn-dock');
    if (!btnDock) return;

    btnDock.innerHTML = '';

    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    primaryBtn.className = 'suicide-danger-confirm-btn';
    primaryBtn.style.borderColor = '#b89030';
    primaryBtn.innerText = primaryLabel;
    primaryBtn.onclick = onPrimary;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'suicide-safe-retreat-btn';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = onCancel;

    btnDock.appendChild(primaryBtn);
    btnDock.appendChild(cancelBtn);
}

function openSecurityOverlayWindow() {
    const overlay = document.getElementById('commander-security-overlay');
    if (!overlay) return;
    overlay.classList.remove('suicide-overlay-hidden');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeSecurityOverlayWindow() {
    const overlay = document.getElementById('commander-security-overlay');
    if (overlay) {
        overlay.style.setProperty('display', 'none', 'important');
        overlay.classList.add('suicide-overlay-hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function renderChangePasswordSecurityForm() {
    const headerTitle = document.getElementById('security-popup-header-title');
    const textField = document.getElementById('security-popup-text-field');
    const username = escapeSecurityFormHtml(getActiveCommanderUsername());

    if (headerTitle) headerTitle.innerText = 'Change Password';
    if (!textField) return;

    textField.innerHTML = `
        <p class="security-account-form-lead">To change your password, confirm the email address you used when you signed up. We will send a reset link to that inbox.</p>
        <p class="security-account-form-meta">Commander: <strong>${username}</strong></p>
        <label class="security-account-form-label" for="security-password-reset-email">Signup email</label>
        <input type="email" id="security-password-reset-email" class="security-account-form-input" placeholder="you@example.com" autocomplete="email">
        <p class="security-account-form-hint">Open the link in that email to set a new password. The link expires after it is used once.</p>
    `;

    mountSecurityOverlayActions(
        'Send reset link',
        () => submitSecurityPasswordResetRequest(),
        () => {
            if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
            closeSecurityOverlayWindow();
        }
    );
}

function renderUpdateEmailSecurityForm(profile) {
    const headerTitle = document.getElementById('security-popup-header-title');
    const textField = document.getElementById('security-popup-text-field');
    const currentEmail = profile.loaded && profile.email
        ? escapeSecurityFormHtml(profile.email)
        : 'Not on file yet';

    if (headerTitle) headerTitle.innerText = 'Update Email Address';
    if (!textField) return;

    textField.innerHTML = `
        <p class="security-account-form-lead">Enter your current password, then your new email. We will send a confirmation link to the <strong>new</strong> address.</p>
        <p class="security-account-form-meta">Current email: <strong>${currentEmail}</strong></p>
        <label class="security-account-form-label" for="security-email-password-field">Current password</label>
        <input type="password" id="security-email-password-field" class="security-account-form-input" placeholder="Current password" autocomplete="current-password">
        <label class="security-account-form-label" for="security-email-new-field">New email address</label>
        <input type="email" id="security-email-new-field" class="security-account-form-input" placeholder="newyou@example.com" autocomplete="email">
        <p class="security-account-form-hint">Your email will not change until you click the confirmation link sent to the new address.</p>
    `;

    mountSecurityOverlayActions(
        'Send confirmation link',
        () => submitSecurityEmailChangeRequest(),
        () => {
            if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
            closeSecurityOverlayWindow();
        }
    );
}

async function submitSecurityPasswordResetRequest() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const username = getActiveCommanderUsername();
    const emailInput = document.getElementById('security-password-reset-email');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!username || username.toLowerCase() === 'testaccount') {
        await showPortalAlert('Log in with a registered commander account to change your password.');
        return;
    }
    if (!email || !email.includes('@')) {
        await showPortalAlert('Enter the email address you used when you signed up.');
        return;
    }

    try {
        const response = await fetch('/api/portal/account/request-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.status !== 'ok') {
            await showPortalAlert(payload.message || 'Could not start password reset. Check your email and try again.', 'Password reset');
            return;
        }

        closeSecurityOverlayWindow();
        await showPortalAlert(
            payload.message || 'If that email matches your account, a password reset link has been sent.',
            'Check your email'
        );
    } catch (err) {
        console.error('Password reset request failed:', err);
        await showPortalAlert('Could not reach the server. Make sure node server.js is running and try again.', 'Connection error');
    }
}

async function submitSecurityEmailChangeRequest() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const username = getActiveCommanderUsername();
    const passwordField = document.getElementById('security-email-password-field');
    const newEmailField = document.getElementById('security-email-new-field');
    const password = passwordField ? passwordField.value : '';
    const newEmail = newEmailField ? newEmailField.value.trim() : '';

    if (!username || username.toLowerCase() === 'testaccount') {
        await showPortalAlert('Log in with a registered commander account to update your email.');
        return;
    }
    if (!password) {
        await showPortalAlert('Enter your current password to confirm this change.');
        return;
    }
    if (!newEmail || !newEmail.includes('@')) {
        await showPortalAlert('Enter a valid new email address.');
        return;
    }

    try {
        const response = await fetch('/api/portal/account/request-email-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, newEmail })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.status !== 'ok') {
            await showPortalAlert(payload.message || 'Could not start email change. Check your details and try again.', 'Email update');
            return;
        }

        closeSecurityOverlayWindow();
        await showPortalAlert(
            payload.message || 'Check your new email inbox and click the confirmation link to finish the update.',
            'Confirmation sent'
        );
    } catch (err) {
        console.error('Email change request failed:', err);
        await showPortalAlert('Could not reach the server. Make sure node server.js is running and try again.', 'Connection error');
    }
}

async function manageSecurityUpdate(mode) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const overlay = document.getElementById('commander-security-overlay');
    const textField = document.getElementById('security-popup-text-field');
    const btnDock = document.getElementById('security-popup-btn-dock');

    if (!overlay || !textField || !btnDock) return;

    textField.innerHTML = '<p class="security-account-form-lead">Loading account security…</p>';
    btnDock.innerHTML = '';
    openSecurityOverlayWindow();

    const profile = await fetchCommanderSecurityProfile();

    if (mode === 'password') {
        renderChangePasswordSecurityForm();
    } else if (mode === 'email') {
        renderUpdateEmailSecurityForm(profile);
    }
}

window.manageSecurityUpdate = manageSecurityUpdate;
window.closeSecurityOverlayWindow = closeSecurityOverlayWindow;



/* ==========================================
   RAGE MODULE: INITIALIZATION & EVENT LISTENERS
   ========================================== */

/* --- Section: Boot Sequence & Audio Handshake --- */

// Live Storage arrays for testing runtime mutations without servers
var activeWartimeRecipients = []; 
var isMassDeletionActive = { inbox: false, system: false, sent: false };
var messageComposeMode = null;
var messageComposeSource = null;
var messageComposeApplyingFromDossier = false;

/** Live recipient directory — populated from the server when messaging is wired; no placeholder accounts. */
const globalFactionServerDirectory = {
    country: {
        name: 'Your Country',
        council: [],
        players: []
    },
    allies: [],
    other: []
};

/** Portal owner — Owner badge in chat & Active Players list; full mailbox recipient roster. */
const PORTAL_OWNER_USERNAMES = new Set(['caleb_admin']);
/** Human moderators — add lowercase usernames here (Royal Guard Bot is separate). */
const PORTAL_MODERATOR_USERNAMES = new Set([]);

/** Automated chat monitor — display name and legacy log aliases. */
const ROYAL_GUARD_BOT_DISPLAY_NAME = 'Royal Guard Bot';
const ROYAL_GUARD_BOT_USERNAME_ALIASES = new Set(['royal guard bot', 'moderator', 'royal guard']);

function isRoyalGuardBotAccount(username) {
    return ROYAL_GUARD_BOT_USERNAME_ALIASES.has(normalizePortalStaffUsername(username));
}

/** @deprecated Alias — use PORTAL_OWNER_USERNAMES */
const MAILBOX_RECIPIENT_ROSTER_ADMIN_USERNAMES = PORTAL_OWNER_USERNAMES;

let mailboxAdminRecipientCategories = null;
let mailboxAdminRecipientRosterLoadPromise = null;

function normalizePortalStaffUsername(username) {
    return String(username || '').trim().toLowerCase();
}

/** @returns {'owner'|'moderator'|null} */
function getPortalStaffRole(username) {
    const key = normalizePortalStaffUsername(username);
    if (!key || isRoyalGuardBotAccount(key)) return null;
    if (PORTAL_OWNER_USERNAMES.has(key)) return 'owner';
    if (PORTAL_MODERATOR_USERNAMES.has(key)) return 'moderator';
    return null;
}

window.getPortalStaffRole = getPortalStaffRole;
window.PORTAL_OWNER_USERNAMES = PORTAL_OWNER_USERNAMES;
window.PORTAL_MODERATOR_USERNAMES = PORTAL_MODERATOR_USERNAMES;
window.ROYAL_GUARD_BOT_DISPLAY_NAME = ROYAL_GUARD_BOT_DISPLAY_NAME;
window.isRoyalGuardBotAccount = isRoyalGuardBotAccount;

function isPortalSiteOwner(username) {
    const key = normalizePortalStaffUsername(
        username !== undefined ? username : getActiveCommanderUsername()
    );
    return !!key && PORTAL_OWNER_USERNAMES.has(key);
}

function isMailboxRecipientRosterAdmin() {
    return isPortalSiteOwner();
}

window.isPortalSiteOwner = isPortalSiteOwner;

async function loadMailboxAdminRecipientRoster(forceReload) {
    if (!isMailboxRecipientRosterAdmin()) {
        mailboxAdminRecipientCategories = null;
        return null;
    }
    if (!forceReload && mailboxAdminRecipientCategories) {
        return mailboxAdminRecipientCategories;
    }
    if (!forceReload && mailboxAdminRecipientRosterLoadPromise) {
        return mailboxAdminRecipientRosterLoadPromise;
    }

    const requester = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    mailboxAdminRecipientRosterLoadPromise = fetch(
        `/api/portal/mailbox-recipient-roster?requester=${encodeURIComponent(requester)}`,
        { cache: 'no-store' }
    )
        .then((response) => response.json())
        .then((payload) => {
            if (payload && payload.allowed && payload.categories) {
                mailboxAdminRecipientCategories = payload.categories;
            } else {
                mailboxAdminRecipientCategories = null;
            }
            return mailboxAdminRecipientCategories;
        })
        .catch(() => {
            mailboxAdminRecipientCategories = null;
            return null;
        })
        .finally(() => {
            mailboxAdminRecipientRosterLoadPromise = null;
        });

    return mailboxAdminRecipientRosterLoadPromise;
}

function escapeRecipientDrawerJsLiteral(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
}

function getMailboxAdminRecipientRosterForCategory(categoryKey) {
    if (!mailboxAdminRecipientCategories) return [];
    const bucket = mailboxAdminRecipientCategories[categoryKey];
    return Array.isArray(bucket) ? bucket.slice() : [];
}

function renderRecipientDrawerRootCategories() {
    const mainPane = document.getElementById('drawer-main-category-view');
    if (!mainPane) return;

    if (isMailboxRecipientRosterAdmin() && mailboxAdminRecipientCategories) {
        const allCount = getMailboxAdminRecipientRosterForCategory('all').length;
        const verifiedCount = getMailboxAdminRecipientRosterForCategory('verified').length;
        const unverifiedCount = getMailboxAdminRecipientRosterForCategory('unverified').length;
        mainPane.innerHTML = `
            <div class="drawer-node-row" onclick="drillDownDirectory('registered-all')">📋 All Registered <span class="drawer-node-count">${allCount}</span><span>►</span></div>
            <div class="drawer-node-row" onclick="drillDownDirectory('registered-verified')">✅ Verified <span class="drawer-node-count">${verifiedCount}</span><span>►</span></div>
            <div class="drawer-node-row" onclick="drillDownDirectory('registered-unverified')">⏳ Pending Verification <span class="drawer-node-count">${unverifiedCount}</span><span>►</span></div>
        `;
        return;
    }

    mainPane.innerHTML = `
        <div class="drawer-node-row" onclick="drillDownDirectory('country')">Country<span>►</span></div>
        <div class="drawer-node-row" onclick="drillDownDirectory('allies')">🤝 Allies <span>►</span></div>
        <div class="drawer-node-row" onclick="drillDownDirectory('other')">🌐 Other<span>►</span></div>
    `;
}

// Commander message folders (inbox, system, drafts) — persisted per commander in localStorage
var playerInboundInboxDossier = [];
var playerSystemInboxDossier = [];
var playerDraftsInboxDossier = [];
var playerSentInboxDossier = [];
var activeMessagesFolder = 'inbox';

function getCommanderMailboxStorageKey() {
    const user = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    return `royalArmiesMailbox:${user || 'guest'}`;
}

function loadCommanderMailboxDossiersFromStorage() {
    try {
        const raw = localStorage.getItem(getCommanderMailboxStorageKey());
        if (!raw) return;
        const data = JSON.parse(raw);
        if (Array.isArray(data.inbox)) playerInboundInboxDossier = data.inbox;
        if (Array.isArray(data.system)) playerSystemInboxDossier = data.system;
        if (Array.isArray(data.drafts)) playerDraftsInboxDossier = data.drafts;
        if (Array.isArray(data.sent)) playerSentInboxDossier = data.sent;
    } catch (err) {
        console.warn('Mailbox restore skipped:', err.message);
    }
    syncNavMailboxIndicators();
}

function saveCommanderMailboxDossiersToStorage() {
    try {
        localStorage.setItem(getCommanderMailboxStorageKey(), JSON.stringify({
            inbox: playerInboundInboxDossier,
            system: playerSystemInboxDossier,
            drafts: playerDraftsInboxDossier,
            sent: playerSentInboxDossier
        }));
    } catch (err) {
        console.warn('Mailbox save skipped:', err.message);
    }
}

function getMailboxApiUsername() {
    const user = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    const trimmed = String(user || '').trim();
    if (!trimmed || trimmed.toLowerCase() === 'testaccount') return '';
    return trimmed;
}

function getCommanderProfileStorageKey() {
    const user = getMailboxApiUsername();
    const fallback = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    const trimmed = String(user || fallback || '').trim();
    return `royalArmiesCommanderProfile:${trimmed || 'guest'}`;
}

function readCommanderProfileFromLocalCache() {
    try {
        const raw = localStorage.getItem(getCommanderProfileStorageKey());
        if (raw) {
            const data = JSON.parse(raw);
            return {
                bio: data.bio != null ? String(data.bio) : '',
                privacy: data.privacy === 'Private' ? 'Private' : 'Public'
            };
        }
    } catch (err) {
        console.warn('Profile cache read skipped:', err.message);
    }

    const savedBio = localStorage.getItem('savedCommanderBio');
    const savedPrivacy = localStorage.getItem('savedCommanderPrivacy');
    return {
        bio: savedBio !== null ? String(savedBio) : '',
        privacy: savedPrivacy === 'Private' ? 'Private' : 'Public'
    };
}

function cacheCommanderProfileLocally(bio, privacy) {
    const payload = {
        bio: String(bio ?? ''),
        privacy: privacy === 'Private' ? 'Private' : 'Public',
        savedAt: Date.now()
    };

    try {
        localStorage.setItem(getCommanderProfileStorageKey(), JSON.stringify(payload));
        localStorage.setItem('savedCommanderBio', payload.bio);
        localStorage.setItem('savedCommanderPrivacy', payload.privacy);
    } catch (err) {
        console.warn('Profile cache save skipped:', err.message);
    }
}

async function fetchCommanderProfileFromServer() {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable()) return false;

    try {
        const response = await fetch(
            `/api/portal/account/profile?username=${encodeURIComponent(username)}`,
            { cache: 'no-store' }
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== 'ok') return false;

        if (typeof player !== 'undefined') {
            player.description = String(payload.bio ?? '');
            player.privacy = payload.privacy === 'Private' ? 'Private' : 'Public';
            cacheCommanderProfileLocally(player.description, player.privacy);
        }
        return true;
    } catch (err) {
        console.warn('Profile sync failed:', err.message);
        return false;
    }
}

async function saveCommanderProfileToServer(bio, privacy) {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable()) return null;

    try {
        const response = await fetch('/api/portal/account/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, bio, privacy })
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'ok') return false;

        cacheCommanderProfileLocally(payload.bio ?? bio, payload.privacy ?? privacy);
        return true;
    } catch (err) {
        console.warn('Profile save failed:', err.message);
        return false;
    }
}

/* isMailboxApiAvailable — provided by dev-environment.js */

async function fetchCommanderMailboxFromServer() {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable()) return false;

    try {
        const response = await fetch(
            `/api/portal/mailbox?username=${encodeURIComponent(username)}`,
            { cache: 'no-store' }
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== 'ok') return false;

        playerInboundInboxDossier = Array.isArray(payload.inbox) ? payload.inbox : [];
        playerSystemInboxDossier = Array.isArray(payload.system) ? payload.system : [];
        playerDraftsInboxDossier = Array.isArray(payload.drafts) ? payload.drafts : [];
        playerSentInboxDossier = Array.isArray(payload.sent) ? payload.sent : [];
        persistMailboxAndSyncNav();
        return true;
    } catch (err) {
        console.warn('Mailbox sync failed:', err.message);
        return false;
    }
}

async function patchMailboxMessageReadOnServer(messageId) {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable() || !Number.isFinite(Number(messageId))) return false;

    try {
        const response = await fetch(`/api/portal/mailbox/${messageId}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

async function deleteMailboxMessageOnServer(messageId, channel) {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable() || !Number.isFinite(Number(messageId))) return false;

    try {
        const response = await fetch(`/api/portal/mailbox/${messageId}?username=${encodeURIComponent(username)}&channel=${encodeURIComponent(channel)}`, {
            method: 'DELETE'
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

async function purgeMailboxMessagesOnServer(channel, ids) {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable() || !Array.isArray(ids) || !ids.length) return false;

    try {
        const response = await fetch('/api/portal/mailbox/purge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, channel, ids })
        });
        const payload = await response.json();
        return response.ok && payload.status === 'ok';
    } catch (err) {
        return false;
    }
}

async function saveMailboxDraftOnServer(recipients, topic, body, draftId) {
    const owner = getMailboxApiUsername();
    if (!owner || !isMailboxApiAvailable()) return null;

    try {
        const response = await fetch('/api/portal/mailbox/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, recipients, topic, body, id: draftId })
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'ok') return null;
        return payload.draft || null;
    } catch (err) {
        return null;
    }
}

async function deleteMailboxDraftOnServer(draftId) {
    const username = getMailboxApiUsername();
    if (!username || !isMailboxApiAvailable() || !Number.isFinite(Number(draftId))) return false;

    try {
        const response = await fetch(`/api/portal/mailbox/drafts/${draftId}?username=${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

function countUnreadPlayerInboxMessages() {
    return playerInboundInboxDossier.filter((msg) => msg && msg.from && !msg.read).length;
}

function countUnreadSystemMessages() {
    return playerSystemInboxDossier.filter((msg) => msg && !msg.read).length;
}

function getUnreadMailboxBreakdown() {
    const inbox = countUnreadPlayerInboxMessages();
    const system = countUnreadSystemMessages();
    return {
        inbox,
        system,
        total: inbox + system
    };
}

function countUnreadMailboxMessages() {
    return getUnreadMailboxBreakdown().total;
}

function resolvePreferredMailboxNavigation() {
    const { inbox, system } = getUnreadMailboxBreakdown();
    if (inbox > 0) {
        return { hubChannel: 'messages', folder: 'inbox' };
    }
    if (system > 0) {
        return { hubChannel: 'system', folder: null };
    }
    return { hubChannel: 'messages', folder: 'inbox' };
}

function updatePortalNewMessagesBarLabels(unreadCount) {
    const label = unreadCount === 1
        ? 'You have a new message'
        : `You have new messages (${unreadCount})`;

    document.querySelectorAll('.portal-commander-new-messages-bar-text').forEach((el) => {
        el.textContent = label;
    });

    document.querySelectorAll('.portal-commander-new-messages-bar').forEach((bar) => {
        bar.setAttribute('aria-label', `${label}. Open messages.`);
    });
}

const PORTAL_MAILBOX_POLL_MS = 30000;
let portalMailboxPollTimer = null;
let portalMailboxUnreadBaseline = null;

function revealPortalNewMessagesBar(shells, isNewArrival) {
    if (!shells || !shells.length) return;
    shells.forEach((shell) => {
        if (!shell) return;
        shell.classList.add('has-unread-messages');
        const bar = shell.querySelector('.portal-commander-new-messages-bar');
        if (bar) bar.hidden = false;
        if (isNewArrival) {
            shell.classList.remove('is-new-messages-arrival');
            void shell.offsetWidth;
            shell.classList.add('is-new-messages-arrival');
        }
    });
    if (isNewArrival) {
        window.setTimeout(() => {
            shells.forEach((shell) => shell && shell.classList.remove('is-new-messages-arrival'));
        }, 900);
    }
}

function hidePortalNewMessagesBar(shells) {
    if (!shells || !shells.length) return;
    shells.forEach((shell) => {
        if (!shell) return;
        shell.classList.remove('has-unread-messages', 'is-new-messages-arrival');
        const bar = shell.querySelector('.portal-commander-new-messages-bar');
        if (bar) bar.hidden = true;
    });
}

function syncCommanderHubMessagesTabBadges(unreadCount) {
    const count = Number.isFinite(unreadCount) ? unreadCount : 0;
    const hasUnread = count > 0;

    document.querySelectorAll('.commander-hub-top-tab[data-hub-tab="messages"]').forEach((tab) => {
        let badge = tab.querySelector('.commander-hub-tab-unread-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'commander-hub-tab-unread-count';
            tab.appendChild(badge);
        }
        if (hasUnread) {
            badge.textContent = String(count);
            badge.hidden = false;
            tab.classList.add('has-unread-messages');
        } else {
            badge.textContent = '';
            badge.hidden = true;
            tab.classList.remove('has-unread-messages');
        }
    });
}

function syncNavMailboxIndicators() {
    const { total: unreadCount } = getUnreadMailboxBreakdown();
    const isNewArrival = portalMailboxUnreadBaseline !== null && unreadCount > portalMailboxUnreadBaseline;
    portalMailboxUnreadBaseline = unreadCount;

    const identityShell = document.getElementById('portal-commander-identity-shell');
    const mobileShell = document.getElementById('portal-mobile-commander-shell');
    const messageShells = [identityShell, mobileShell].filter(Boolean);
    const countEl = document.getElementById('nav-messages-unread-count');
    const messagesBtn = document.getElementById('nav-dropdown-messages-btn');
    const hasUnread = unreadCount > 0;

    if (hasUnread) {
        updatePortalNewMessagesBarLabels(unreadCount);
        revealPortalNewMessagesBar(messageShells, isNewArrival);
    } else {
        hidePortalNewMessagesBar(messageShells);
    }

    if (countEl) {
        if (hasUnread) {
            countEl.textContent = String(unreadCount);
            countEl.hidden = false;
        } else {
            countEl.textContent = '';
            countEl.hidden = true;
        }
    }

    if (messagesBtn) {
        messagesBtn.classList.toggle('has-unread-messages', hasUnread);
        messagesBtn.setAttribute(
            'aria-label',
            hasUnread ? `Messages, ${unreadCount} unread` : 'Messages'
        );
    }

    syncCommanderHubMessagesTabBadges(unreadCount);

    if (typeof syncPortalMobileNavMailboxIndicators === 'function') {
        syncPortalMobileNavMailboxIndicators(unreadCount);
    }
}

function openMailboxFromNewMessagesBar(clickEvent) {
    if (clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
    }
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const preferred = resolvePreferredMailboxNavigation();
    window.pendingMessagesHubChannel = preferred.hubChannel;
    window.pendingMessagesFolder = preferred.folder;

    const onMainPortal = Boolean(
        document.getElementById('portal-navigation-chassis')
        || document.getElementById('portal-commander-hub-page')
        || document.getElementById('commander-hub-modal')
    );

    if (onMainPortal) {
        if (typeof openCommanderHubModal === 'function') {
            openCommanderHubModal('messages', clickEvent);
            return;
        }
        if (typeof switchMainPortalView === 'function') {
            switchMainPortalView('commander', clickEvent);
        }
        if (typeof loadCommanderHubSection === 'function') {
            loadCommanderHubSection('messages', clickEvent);
            return;
        }
        if (typeof loadLore === 'function') {
            loadLore('messages');
        }
        return;
    }

    try {
        sessionStorage.setItem('royalArmiesPendingMailboxNav', JSON.stringify(preferred));
    } catch (_err) {
        /* ignore */
    }

    if (window.RoyalArmiesPageRouteTransition && typeof window.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
        window.RoyalArmiesPageRouteTransition.navigateTo('/main');
        return;
    }
    window.location.href = '/main';
}

function consumePendingMailboxNavigation() {
    let raw = null;
    try {
        raw = sessionStorage.getItem('royalArmiesPendingMailboxNav');
        if (raw) sessionStorage.removeItem('royalArmiesPendingMailboxNav');
    } catch (_err) {
        return;
    }
    if (!raw) return;

    try {
        const pending = JSON.parse(raw);
        window.pendingMessagesHubChannel = pending.hubChannel || 'messages';
        window.pendingMessagesFolder = pending.folder || 'inbox';
    } catch (_err) {
        return;
    }

    window.setTimeout(() => {
        if (typeof openCommanderHubModal === 'function') {
            openCommanderHubModal('messages', null);
            return;
        }
        if (typeof switchMainPortalView === 'function') {
            switchMainPortalView('commander', null);
        }
        if (typeof loadCommanderHubSection === 'function') {
            loadCommanderHubSection('messages', null);
        }
    }, 120);
}

function bindPortalNewMessagesBarNavigation() {
    document.querySelectorAll('.portal-commander-new-messages-bar').forEach((bar) => {
        if (!bar || bar.dataset.mailboxNavBound === 'true') return;
        bar.dataset.mailboxNavBound = 'true';
        bar.addEventListener('click', openMailboxFromNewMessagesBar);
    });
}

async function pollCommanderMailboxFromServer() {
    if (typeof isPortalUserAuthenticated === 'function' && !isPortalUserAuthenticated()) {
        portalMailboxUnreadBaseline = 0;
        syncNavMailboxIndicators();
        return false;
    }
    if (typeof fetchCommanderMailboxFromServer !== 'function') return false;
    return fetchCommanderMailboxFromServer();
}

function startPortalMailboxPolling() {
    if (portalMailboxPollTimer) {
        clearInterval(portalMailboxPollTimer);
        portalMailboxPollTimer = null;
    }

    if (typeof isMailboxApiAvailable === 'function' && !isMailboxApiAvailable()) {
        syncNavMailboxIndicators();
        return;
    }

    const runPoll = () => {
        pollCommanderMailboxFromServer();
    };

    runPoll();
    portalMailboxPollTimer = setInterval(runPoll, PORTAL_MAILBOX_POLL_MS);

    if (!window.__royalArmiesMailboxVisibilityBound) {
        window.__royalArmiesMailboxVisibilityBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') runPoll();
        });
    }
}

function stopPortalMailboxPolling() {
    if (portalMailboxPollTimer) {
        clearInterval(portalMailboxPollTimer);
        portalMailboxPollTimer = null;
    }
}

function persistMailboxAndSyncNav() {
    saveCommanderMailboxDossiersToStorage();
    syncNavMailboxIndicators();
}

/** Delivers test/player mail via the ledger API (console: receiveCommanderInboxMessage('Sender', 'Subject', 'Body')). */
async function receiveCommanderInboxMessage(from, topic, body) {
    if (!from || !String(from).trim()) return null;

    const to = getMailboxApiUsername();
    if (!to) {
        console.warn('Mailbox inject skipped: log in with a registered commander on port 3000.');
        return null;
    }

    if (isMailboxApiAvailable()) {
        try {
            const response = await fetch('/api/portal/mailbox/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    from: String(from).trim(),
                    topic: String(topic || 'No subject').trim(),
                    body: String(body || '').trim()
                })
            });
            const payload = await response.json();
            if (response.ok && payload.status === 'ok') {
                await fetchCommanderMailboxFromServer();
                return payload.message || null;
            }
            console.warn('Mailbox inject failed:', payload.message || response.status);
        } catch (err) {
            console.warn('Mailbox inject failed:', err.message);
        }
    }

    return null;
}

loadCommanderMailboxDossiersFromStorage();

let currentUser = null;
let isMuted = false;
let activeTrackId = 'main-theme';
let audioContext, gainNode, source;

// --- 1. THE AUDIO OVERDRIVE ENGINE ---
function boostVolume(multiplier) {
    const music = document.getElementById(activeTrackId);
    if (!music) return;
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Re-connect source whenever track changes or boost is called
        const currentSource = audioContext.createMediaElementSource(music);
        gainNode = audioContext.createGain();
        currentSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        gainNode.gain.value = multiplier;
        console.log(`Aether Amplification: ${multiplier * 100}%`);
    } catch (e) { console.warn("Browser restricted high-gain audio."); }
}

// --- 2. THE SYMPHONY HANDSHAKE (Landing Unlock) ---
const unlockAudio = () => { 
    const music = document.getElementById('main-theme'); 
    if (music && music.paused && !isMuted) { 
        // THE INITIALIZATION SYNC: Pulls your saved mixer settings into the HTML player right on bootup!
        music.volume = confirmedMusicVol * confirmedMasterVol; 
        
        music.play()
            .then(() => console.log("Stone and Water Authorized.")) 
            .catch(() => console.log("Interaction required for audio.")); 
    } 
    // Remove listeners after first successful interaction 
    ['click', 'keydown', 'mousedown', 'touchstart'].forEach(e => document.removeEventListener(e, unlockAudio)); 
}; 

['click', 'keydown', 'mousedown', 'touchstart'].forEach(e => document.addEventListener(e, unlockAudio, { once: true }));

// --- 3. SUCCESSFUL ENTRY THEME (Triggered by Admin Bypass) ---
function playLoginMusic() {
    const mainTheme = document.getElementById('main-theme');
    const loginTheme = document.getElementById('login-theme');
    
    if (!mainTheme || !loginTheme) return;

    // 1. Silence and reset landing theme
    mainTheme.pause();
    mainTheme.currentTime = 0;

    // 2. Switch control to Archimedes Lullaby
    activeTrackId = 'login-theme';
    if (!isMuted) {
        loginTheme.volume = 1.0;
        loginTheme.play().then(() => console.log("Now Playing: Archimedes Lullaby"))
            .catch(e => console.log("Login music waiting for final click."));
    }
}

// --- 4. THE BOOT SEQUENCE (Local Only Mode) ---
window.onload = () => {
    console.log("Aether Engine Synchronized. Local Logic Active.");
    if (typeof initializeDeveloperMaintenanceAlert === 'function') {
        initializeDeveloperMaintenanceAlert();
    }
    const landing = document.getElementById('page-landing');
    if (landing) {
        landing.style.display = 'flex';
        landing.style.opacity = '1';
    }
    initializeDataLink();
};

function initializeDataLink() {
    if (!document.getElementById('page-landing')) {
        if (typeof autoDetectPlayerLocale === 'function') autoDetectPlayerLocale();
        return;
    }

    const initInterval = setInterval(() => {
        // Only stops looking once game data variables are found in memory
        if (typeof groundRanks !== 'undefined' && typeof unitDatabase !== 'undefined') {
            clearInterval(initInterval);
            
            // THE AUTOMATIC LOCALE HOOK:
            // Natively pulls timezone and region configurations before components load
            if (typeof autoDetectPlayerLocale === "function") {
                autoDetectPlayerLocale();
            }
            
            if (typeof initDashboard === "function") {
                initDashboard();
            }
            
            // THE AUTOMATED DISCIPLINE STEP:
            // Fires your custom active strike check right as the dashboard finishes initializing!
            if (typeof checkSystemLoginPenalties === "function") {
                checkSystemLoginPenalties();
            }
        }
    }, 100);
}

// --- 5. AUDIO CONTROLS (Universal Toggle) ---
function toggleMute() {
    const music = document.getElementById(activeTrackId);
    const icon = document.getElementById('audio-icon');
    const control = document.getElementById('audio-control');
    if (!music) return;

    if (!music.muted) {
        music.muted = true;
        isMuted = true;
        if (icon) icon.className = 'landing-audio-icon icon-muted';
        if (control) control.setAttribute('aria-pressed', 'true');
        console.log("Ambiance Silenced.");
    } else {
        music.muted = false;
        isMuted = false;
        music.play();
        // If overdrive was active, resume the context
        if (audioContext) audioContext.resume();
        if (icon) icon.className = 'landing-audio-icon icon-unmuted';
        if (control) control.setAttribute('aria-pressed', 'false');
        console.log("Symphony Resumed.");
    }
}

/* ==========================================
   RAGE MODULE: AUTHENTICATION & LOGIN FLOW
   ========================================== */

/* --- Section: Chronicle Data & Login Engine --- */

/** Shown on the Age Portal (metrics strip, header) and in release notes. */
const PORTAL_ALPHA_VERSION = 'Alpha 0.1.13';

/* --- Block 2: The Chronicle Archives (Full Data Set) --- */
const CHRONICLE_DATA = {
    alpha_0113: {
        title: "Alpha 0.1.13 — Royalty, Lore & Portal Polish",
        details: "Royal Armies Alpha 0.1.13 polishes the Age Portal with clearer membership pages, a reworked Lore codex, profile medals, and quality-of-life fixes across desktop and mobile.\n\nWhat's new: the Royalty page now shows Standard and Premium plans with artwork and short perk lists for free and Royalty commanders; The Chronicles uses familiar Battle Pass wording with separate Free Pass and Premium Pass reward lanes; the Lore tab on desktop displays all fifteen nations in a 4×4 codex grid beside a wider story reader; commander profiles include a Medals section above Achievements, ready for honors you earn in Ages; desktop players see a custom gauntlet cursor without the default hand overlapping buttons and links; text sitting on the background artwork is easier to read across the hub; mobile messaging no longer pushes the recipient list down when you open a nation category; guests browsing on desktop see centered navigation tabs; the browser tab title now shows the full Royal Armies name.\n\nThe full battle client is still in development. Thank you for helping us shape Royal Armies."
    },
    alpha_0112: {
        title: "Alpha 0.1.12 — Lore, Chat & Chronicles",
        publishAt: "2026-05-21T13:00:00.000Z",
        details: "Royal Armies Alpha 0.1.12 expands the Age Portal with lore, social tools, and Chronicle progression.\n\nWhat's new: the Lore tab is now open on the official website — browse nation chronicles with crest artwork, a larger reader, and an optional Listen button (background music softens while narration plays); Community Chat lets you reply to other commanders and edit your own messages (hover a message to see Reply or Edit); The Chronicles adds separate Basic (free) and Premium (Royalty) reward tracks with 50 levels each, milestone rewards on select levels only, and Chronicle XP earned through play in Ages — city battles, PvP, map lore, and more — independent of commander rank promotions; the Royalty page explains Bronze (free) vs paid Royalty membership for the premium track; Age countdowns are paused and show -- : -- : -- : -- while we prepare the next Age, with loading text reading “The Age has Yet to Arrive!”; account settings support real password and email change requests; a custom cursor and clearer menus/alerts polish the hub.\n\nWhen we are actively building, a development notice may appear at the top of the portal — thank you for your patience. Royalty and The Chronicles tabs may still be rolling out on the live site after this update.\n\nThank you for helping us shape Royal Armies."
    },
    alpha_0111: {
        title: "Alpha 0.1.11 — Age Portal",
        details: "Royal Armies Alpha 0.1.11 is live. This update focuses on the Age Portal—the hub you reach after logging in.\n\nWhat's new: a dedicated portal home with navigation for the current Age, leaderboards, and community chat; a commander hub to edit your profile, read messages, and adjust audio settings; live registration and activity counts when connected to our servers; and a clearer Join the Age flow with sound and visual feedback (the full battle screen is still in development).\n\nAcross the site, menus, alerts, and chat labels have been rewritten in plain English. When we are actively building or testing, a notice may appear at the top of the page—thank you for your patience. On the live website, Lore, Royalty, and The Chronicles are visible but locked until their content is ready.\n\nWe are continuing work on the core game experience. Thank you for helping us shape Royal Armies."
    },
    genesis: { title: "Core framework", details: "Built the main UI theme, background slideshow, and first server connections." },
    audio: { title: "Audio system", details: "Added background music, UI sounds, volume controls, and smooth mute behavior." },
    narrative: { title: "Story intro", details: "Added the guided intro flow and typewriter text for lore moments." },
    interface: { title: "Navigation and roadmap", details: "Built the wide roadmap panel and hub layout so menus line up with icons." },
    security: { title: "Login and accounts", details: "Added secure login, registration, email confirmation, and a developer test bypass." },
    assets: { title: "Art pipeline", details: "Merged UI images in GIMP to reduce load time, flicker, and scaling issues." },
    optimization: { title: "Performance", details: "Improved frame timing, transitions, and centered layout for the Age Portal." },
    networking: { title: "Live sync", details: "Connected the client to the server for player state and global events." },
    roadmap_foundation: { title: "Phase 1: Foundation", details: "Core app structure, login, art pipeline, and the landing portal." },
    roadmap_combat: { title: "Phase 2: Combat sync", details: "Real-time combat hits, spell animations, and shared battle state." },
    roadmap_classes: { title: "Phase 3: Classes", details: "Battlemaster and Archmage skill trees, crests, and ability loadouts." },
    roadmap_world: { title: "Phase 4: World map", details: "Larger explorable map, zone audio, and story checkpoints." },
    roadmap_economy: { title: "Phase 5: Economy", details: "Gold flow, vendors, and player inventory." },
    roadmap_launch: { title: "Phase 6: Launch", details: "Live release prep, community events, global accounts, and public opening." },
    networking_nexus: { title: "Registration server", details: "Server-side registration and automated confirmation emails for new accounts." 
    },
};

/* --- Block 3: The Master Close Protocol (The UI Sync) --- */
function closeAllActiveUI(e) {
    if (e && e.target) {
        if (e.target.classList.contains('nav-icon') || e.target.closest('.updates-hub') || e.target.id === 'roadmap-trigger') {
            return; 
        }
    }
    const updates = document.getElementById('updates-panel');
    if (updates) updates.style.display = 'none';
    const roadmap = document.getElementById('roadmap-modal');
    if (roadmap) { roadmap.style.display = 'none'; roadmap.style.opacity = '0'; }
    const detail = document.getElementById('chronicle-detail-modal');
    if (detail) { detail.style.display = 'none'; detail.style.opacity = '0'; }
    const register = document.getElementById('register-modal');
    if (register) {
        register.style.opacity = '0';
        register.style.display = 'none';
        register.classList.add('main-portal-modal-hidden');
    }
    const forgot = document.getElementById('forgot-modal');
    if (forgot) {
        forgot.style.opacity = '0';
        forgot.style.display = 'none';
        forgot.classList.add('main-portal-modal-hidden');
    }
    closeMainPortalLoginModal();
}

/* --- Block 4: The Login Engine --- */
function restoreLoginAuthButtons() {
    const authButtons = document.getElementById('auth-buttons');
    const loader = document.getElementById('auth-loading');
    if (loader) loader.style.display = 'none';
    if (authButtons) {
        authButtons.style.display = 'flex';
        authButtons.style.opacity = '1';
        authButtons.style.pointerEvents = 'auto';
    }
}

/* isLandingServedByNexusBackend — provided by dev-environment.js */

function redirectToAgePortal() {
    sessionStorage.setItem('royalArmiesAuthAudioPlay', 'granted');
    window.location.assign('/main');
}

async function handleLogin() {
    const userVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value;

    const isAdmin = (userVal === 'IAmBeyondLegend' && passVal === 'Tor1pedo01!');
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) {
        authButtons.style.display = 'none';
        authButtons.style.opacity = '0';
    }
    const loader = document.getElementById('auth-loading');
    if (loader) loader.style.display = 'block';

    if (!userVal || !passVal) {
        await showPortalAlert('Please enter your username and password.');
        restoreLoginAuthButtons();
        return;
    }

    const canUseLedgerApi = typeof isLandingServedByNexusBackend === 'function' && isLandingServedByNexusBackend();
    const isLocalPreview = typeof isLocalDevelopmentHost === 'function' && isLocalDevelopmentHost();

    if (!isAdmin && !canUseLedgerApi && !isLocalPreview) {
        await showPortalAlert(
            'Login needs the Royal Armies server.\n\n' +
            '1. In a terminal, run: node server.js\n' +
            '2. Open: http://localhost:3000',
            'Server required'
        );
        restoreLoginAuthButtons();
        return;
    }

    if (!isAdmin && isLocalPreview && !canUseLedgerApi) {
        try {
            const health = await fetch(
                typeof resolveRoyalArmiesApiUrl === 'function'
                    ? resolveRoyalArmiesApiUrl('/api/portal/metrics')
                    : 'http://localhost:3000/api/portal/metrics',
                { cache: 'no-store' }
            );
            if (!health.ok) {
                throw new Error('Server not reachable');
            }
        } catch (_err) {
            await showPortalAlert(
                'Live Server can open all portal pages, but login and messages need the API.\n\n' +
                '1. Run: node server.js\n' +
                '2. Keep Live Server open, then refresh this page.',
                'Start node server.js'
            );
            restoreLoginAuthButtons();
            return;
        }
    }

    const rememberMe = resolvePortalLoginRememberMe();

    if (isAdmin) {
        persistPortalAuth(userVal, rememberMe);
        if (typeof player !== 'undefined') player.name = userVal;
        refreshProfileCommanderNameDisplay();
        refreshLoggedUserTagDisplay();
        if (isMainPortalHub()) {
            finishMainPortalLoginSession(true);
        } else {
            redirectToAgePortal();
        }
        return;
    }

    if (typeof autoDetectPlayerLocale === 'function') {
        autoDetectPlayerLocale();
    }

    const loginLocale = (typeof player !== 'undefined' && player)
        ? {
            country: String(player.country || '').trim(),
            timezone: String(player.timezone || '').trim()
        }
        : {};

    try {
        const response = await fetch(
            typeof resolveRoyalArmiesApiUrl === 'function'
                ? resolveRoyalArmiesApiUrl('/api/login')
                : '/api/login',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: canUsePortalAuthSessionApi() ? 'include' : 'same-origin',
                body: JSON.stringify({
                    username: userVal,
                    password: passVal,
                    rememberMe,
                    country: loginLocale.country,
                    timezone: loginLocale.timezone
                })
            }
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            await showPortalAlert(payload.message || 'Login failed. Check your username and password.', 'Login failed');
            restoreLoginAuthButtons();
            return;
        }

        const ledgerUsername = payload.username || userVal;
        persistPortalAuth(ledgerUsername, payload.rememberMe !== false && rememberMe);
        if (typeof player !== 'undefined') player.name = ledgerUsername;
        refreshProfileCommanderNameDisplay();
        refreshLoggedUserTagDisplay();
        if (typeof stashPendingAchievementUnlocks === 'function') {
            stashPendingAchievementUnlocks(payload.achievementUnlocks);
        } else if (window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.stashPendingAchievementUnlocks === 'function') {
            window.RoyalArmiesAchievements.stashPendingAchievementUnlocks(payload.achievementUnlocks);
        }
        if (isMainPortalHub()) {
            finishMainPortalLoginSession(false);
        } else {
            initiatePostLoginSequence(false);
        }
    } catch (err) {
        console.error('NEXUS login link error:', err);
        await showPortalAlert('Cannot reach the Royal Armies server. Run node server.js locally (or use the live site) and try again.', 'Connection error');
        restoreLoginAuthButtons();
    }
}

function finishMainPortalLoginSession(isAdmin) {
    if (typeof clearLocalDevLogoutFlag === 'function') {
        clearLocalDevLogoutFlag();
    }
    if (typeof setLocalDevViewMode === 'function' && typeof isLocalDevAutoLoginEnabled === 'function' && isLocalDevAutoLoginEnabled()) {
        const user = getActiveCommanderUsername().toLowerCase();
        setLocalDevViewMode(user === 'caleb_admin' || isAdmin ? 'owner' : 'player');
    }
    restoreLoginAuthButtons();
    closeMainPortalLoginModal();
    refreshMainPortalAuthChrome();
    if (typeof recacheAgePortalViewportSnapshot === 'function') {
        recacheAgePortalViewportSnapshot();
    }
    syncPlayerFromActiveCommanderStorage();
    if (typeof hydrateCommanderMembershipFromStorage === 'function') {
        hydrateCommanderMembershipFromStorage();
    }
    if (typeof initializePortalLivePlayerMetrics === 'function') {
        initializePortalLivePlayerMetrics();
    }
    if (!isAdmin) {
        console.log('Login accepted. Age Portal session active.');
        if (typeof syncCommanderLocaleAfterAuth === 'function') {
            syncCommanderLocaleAfterAuth();
        }
    }
    if (!isAdmin && typeof maybeShowPendingLoginAchievementUnlocks === 'function') {
        setTimeout(() => maybeShowPendingLoginAchievementUnlocks(), 700);
    } else if (!isAdmin && window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks === 'function') {
        setTimeout(() => window.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks(), 700);
    }
}

/* --- Block 5: Post-Login Transition --- */
function initiatePostLoginSequence(isAdmin) {
    if (isMainPortalHub()) {
        finishMainPortalLoginSession(isAdmin);
        return;
    }
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');
    
    if(loginWrapper) loginWrapper.style.opacity = '0';
    if(authButtons) authButtons.style.opacity = '0';
    
    setTimeout(() => {
        if (!isAdmin) {
            console.log('Login accepted. Redirecting to Age Portal (main.html)...');
            redirectToAgePortal();
            return;
        }

        if(loginWrapper) loginWrapper.style.display = 'none';
        if(authButtons) authButtons.style.display = 'none';
        
        if(messageBox) {
            messageBox.style.display = 'block';
            setTimeout(() => messageBox.style.opacity = '1', 50);
        }
        
        if(discordIcon) {
            discordIcon.style.display = 'block';
            setTimeout(() => discordIcon.style.opacity = '1', 50);
        }
        
        if(bypassBtn) {
            bypassBtn.style.display = 'block';
            setTimeout(() => bypassBtn.style.opacity = '1', 50);
        }
        
        console.log("Administrative Authorization Confirmed. Matrix Override Ready.");
        
    }, 400);
}

/* --- Block 6: Navigation Toggle Sync --- */
function toggleUpdates(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('updates-panel');
    const roadmap = document.getElementById('roadmap-modal');
    if (panel.style.display === 'none' || panel.style.display === '') {
        if (roadmap) roadmap.style.display = 'none'; 
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

function toggleRoadmap(show, event) {
    if (event) event.stopPropagation();
    const roadmap = document.getElementById('roadmap-modal');
    const updates = document.getElementById('updates-panel');
    if (roadmap.style.display === 'none' || roadmap.style.display === '') {
        if (updates) updates.style.display = 'none'; 
        roadmap.style.display = 'flex';
    } else {
        roadmap.style.display = 'none';
    }
}

/* --- Block 7: Redirects & Modals (Registration & Recovery) --- */

function enterMainGame() {
    redirectToAgePortal();
}

function openDiscord() {
    // ⚔️ NEXUS: Access granted to all Commanders immediately
    window.open('https://discord.gg/7tGBCt7cXX', '_blank');
}

function handleRegister() {
    if (isMainPortalHub()) {
        closeMainPortalLoginModal();
    } else {
        closeAllActiveUI();
    }
    const modal = document.getElementById('register-modal');
    if (modal) {
        modal.classList.remove('main-portal-modal-hidden');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    }
}

function closeRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.add('main-portal-modal-hidden');
        }, 300);
    }
}

function handleForgot(e) {
    if (e) e.preventDefault();
    if (isMainPortalHub()) {
        closeMainPortalLoginModal();
    } else {
        try {
            if (typeof closeAllActiveUI === 'function') closeAllActiveUI();
        } catch (err) {
            console.warn('NEXUS: UI Cleanup bypassed.');
        }
    }
    const modal = document.getElementById('forgot-modal');
    if (modal) {
        modal.classList.remove('main-portal-modal-hidden');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    }
}

function closeForgot() {
    const modal = document.getElementById('forgot-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.add('main-portal-modal-hidden');
        }, 300);
    }
}

/* --- THE SUBMISSION PROTOCOL (NEXUS Handshake Enabled) --- */

async function submitRegistration() {
    const user = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!user || !email || !pass || !confirm) {
        await showPortalAlert('Please fill in all registration fields.');
        return;
    }
    if (pass !== confirm) {
        await showPortalAlert('Your passwords do not match. Re-verify your credentials.');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.trim(), email: email.trim(), password: pass })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
            await showPortalAlert(payload.message || 'Registration saved. Check your email to confirm your account.', 'Registration');
            closeRegister();
            return;
        }
        await showPortalAlert(payload.message || 'Registration could not be completed.', 'Registration');
    } catch (err) {
        console.error('Nexus Link Error:', err);
        await showPortalAlert('Cannot reach the Royal Armies server. Make sure node server.js is running, then try again.', 'Connection error');
    }
}

async function submitForgot(e) {
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput ? emailInput.value : '';
    const btn = e ? e.target : event.target;

    if (!email || !email.includes('@')) {
        await showPortalAlert('Please enter a valid email address.');
        return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Sending...';

    try {
        const response = await fetch('/request-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) throw new Error('Server Rejected Connection');
        await response.json().catch(() => ({}));
        await showPortalAlert('A one-time password link will be sent to the e-mail provided if it is in our records.', 'Password reset');
        closeForgot();
    } catch (err) {
        console.error('Nexus Link Error:', err);
        await showPortalAlert('Could not reach the server. Try again in a moment.', 'Connection error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

/* --- Block 8: Archive Detail Logic (NEWLY RESTORED) --- */
function openChronicleDetail(id, event) {
    if (event) event.stopPropagation();
    const data = CHRONICLE_DATA[id];
    const modal = document.getElementById('chronicle-detail-modal');
    const titleEl = document.getElementById('chronicle-detail-title');
    const textEl = document.getElementById('chronicle-detail-text');

    if (!data || !modal) return;

    // Inject Content
    titleEl.innerText = data.title;
    textEl.innerText = data.details;

    // Show Modal
    modal.style.display = 'flex';
    // Small delay to trigger the CSS opacity transition
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
}

function closeChronicleDetail() {
    const modal = document.getElementById('chronicle-detail-modal');
    if (modal) {
        modal.style.opacity = '0';
        // Wait for fade to finish before hiding
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

/* ==========================================
   RAGE MODULE: CINEMATIC & NARRATIVE ENGINES
   ========================================== */



/* ==========================================
   RAGE MODULE: HUD & PAGE MANAGEMENT
   ========================================== */



/* ==========================================
   RAGE MODULE: ARMY MANAGEMENT & RECRUITMENT
   ========================================== */



/* ==========================================
   RAGE MODULE: BATTLE SIMULATION & RESOLVE
   ========================================== */



/* ==========================================
   RAGE MODULE: SESSION CONTROL & INTERFACE SFX
   ========================================== */

/* --- Section: Global UI Sound Hooks --- */

/* --- Block 9: Global Audio Engine (audio/uihover.wav) --- */
document.addEventListener('mouseover', (e) => {
    // This looks for anything clickable (icons, buttons, lore titles, cards, links)
    const target = e.target.closest('.nav-icon, .img-btn, .radial-slot, .update-item, .quest-card, .close-modal, .forgot-link, .confirm-btn, .revert-btn');
    
    if (target && !target.classList.contains('disabled')) {
        const hoverSound = document.getElementById('hover-sound');
        if (hoverSound) {
hoverSound.volume = 0.2;
            hoverSound.currentTime = 0; // Resets sound so it can play rapidly
            hoverSound.play().catch(() => { 
                /* Prevents console errors if user hasn't clicked anything yet */ 
            });
        }
    }
});

/* --- Block 10: Global Selection Engine (uiselect.wav) --- */
document.addEventListener('click', (e) => {
    // Finds the clickable target (buttons, icons, lore titles, etc.)
    const target = e.target.closest('.nav-icon, .img-btn, .radial-slot, .update-item, .quest-card, .close-modal, .forgot-link, .confirm-btn, .revert-btn');
    
    if (target && !target.classList.contains('disabled')) {
        const selectSound = document.getElementById('select-sound');
        if (selectSound) {
            // Reset to 0 so it can play again immediately if double-clicked
            selectSound.currentTime = 0; 
            
            // Set a slightly lower volume so it doesn't pierce the ears
            selectSound.volume = 0.2; 
            
            selectSound.play().catch(() => {
                /* Handles any browser-side blocking */
            });
        }
    }
});

/* --- Block 11: Logout and Portal Reset --- */
function handleLogout() {
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');
    const loader = document.getElementById('auth-loading');

    if (loader) loader.style.display = 'none';
    if (messageBox) {
        messageBox.style.display = 'none';
        messageBox.style.opacity = '0';
    }
    if (bypassBtn) bypassBtn.style.display = 'none';

    // Deactivate Discord Pulse but do NOT disable it (keep color)
    if (discordIcon) {
        discordIcon.classList.remove('pulse-discord');
    }

    if (loginWrapper) {
        loginWrapper.style.display = 'flex';
        loginWrapper.style.opacity = '1';
    }
    if (authButtons) {
        authButtons.style.display = 'flex';
        authButtons.style.opacity = '1';
        authButtons.style.pointerEvents = 'auto';
    }

    const landing = document.getElementById('page-landing');
    if (landing) {
        landing.style.display = "flex";
        setTimeout(() => {
            landing.style.transition = "opacity 1.5s ease";
            landing.style.opacity = "1";
        }, 10);
    }

    const userIn = document.getElementById('login-username');
    const passIn = document.getElementById('login-password');
    if (userIn) userIn.value = "";
    if (passIn) passIn.value = "";
    
    // Close Lore Modal if it was open
    closeLoreModal();

    console.log("Portal Reset: Authenticating text cleared and UI restored.");
}

/* --- Block 12: Lore Nexus Controller --- */
function openLoreModal() {
    const modal = document.getElementById('lore-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
        loadLore('settings');
    }
}

/* --- Block 13: Font Accessibility Controller --- */ 
function toggleDyslexiaFont(e) { 
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    
    hasUnsavedChanges = true;
    setDyslexiaFontEnabled(!isDyslexiaFontEnabled());
}

/* --- Block 14: Lore Nexus Controller (Updated) --- */
function closeLoreModal() { 
    if (hasUnsavedChanges) { 
        // Silent revert: Automatically drops pending changes without an ugly alert box
        revertSettings(); 
    } // <--- THE FIX: This closing brace was missing, causing the Coding AI error!

    const modal = document.getElementById('lore-modal'); 
    if (modal) { 
        modal.style.opacity = '0'; 
        setTimeout(() => { 
            modal.style.display = 'none'; 
        }, 300); 

        // 1. CLEAR THE TRACKED AUDIO SAFELY
        if (currentNarration) { 
            // Shields 'background_music' from the kill switch so your soundtrack stays alive
            if (!currentNarration.src.includes('background_music') && !currentNarration.isAmbientTrack) { 
                currentNarration.pause(); 
                currentNarration.currentTime = 0; 
                currentNarration = null; 
            } 
        } 
    } 
}

/* ==========================================
   RAGE MODULE: COMMANDER HUB CONTENT (messages, settings, profile)
   Nation chronicles + narration live in script2.js (portal Lore tab).
   ========================================== */

const nationLore = {
    // ==========================================================================
    // NEW MESSAGING DATABASE LOGS (SAFELY ENCLOSED IN BACKTICKS AS A TEXT STRING)
    // ==========================================================================
    messages: [
        {
            name: "Send a Message",
            detail: `
                <div class="message-workspace-canvas message-compose-canvas">
                    <div id="msg-compose-context-banner" class="msg-compose-context-banner msg-compose-context-hidden" aria-hidden="true"></div>
                    <!-- TARGET COMPASS LINE -->
                    <div class="message-input-row-block msg-send-to-row">
                        <label class="msg-field-label">To</label>
                        <div class="send-to-pill-container" id="msg-recipient-pill-dock">
                            <span class="pill-placeholder-txt">Select Recipients</span>
                        </div>
                        <button type="button" class="msg-recipient-add-btn" id="msg-recipient-add-btn" onclick="toggleRecipientDirectory(event)">➕</button>
                    </div>
                    <div id="msg-recipient-directory-slot" class="msg-recipient-directory-slot msg-recipient-directory-slot--collapsed" aria-hidden="true">
                        <div id="msg-directory-floating-drawer" class="msg-floating-drawer-hidden" onclick="event.stopPropagation()">
                            <div class="drawer-header-title">📜 Recipients</div>
                            <div class="msg-directory-drawer-body">
                                <div class="drawer-category-scroll-bin" id="drawer-main-category-view">
                                    <div class="drawer-node-row" onclick="drillDownDirectory('country')">Country<span>►</span></div>
                                    <div class="drawer-node-row" onclick="drillDownDirectory('allies')">🤝 Allies <span>►</span></div>
                                    <div class="drawer-node-row" onclick="drillDownDirectory('other')">🌐 Other<span>►</span></div>
                                </div>
                                <div class="drawer-category-scroll-bin msg-drawer-pane-hidden" id="drawer-drilldown-category-view"></div>
                            </div>
                        </div>
                    </div>
                    <!-- SUBJECT MATRICES HEADER LINE -->
                    <div class="message-input-row-block msg-topic-row">
                        <label class="msg-field-label">Subject</label>
                        <input type="text" id="msg-subject-input-element" placeholder="" maxlength="60">
                    </div>
                    <!-- RAW PLAIN PARCHMENT SCROLL TEXT AREA -->
                    <div class="message-input-row-block flex-grow-area">
                        <label class="msg-field-label"></label>
                        <textarea id="msg-body-input-element" placeholder=""></textarea>
                    </div>
                    <!-- TRANSACTION DISPATCH CONTROLS DECK -->
                    <div class="message-action-deck-row">
                        <button class="settings-btn" onclick="executeOutgoingMessageDispatch()">Send message</button>
                        <button class="settings-btn" style="border-color: rgba(184,144,48,0.3) !important;" onclick="commitMessageToDraftCache()">Save As Draft</button>
                    </div>
                </div>
            `
        },
        {
            name: "Messages",
            detail: `
                <div class="message-workspace-canvas message-mailbox-canvas">
                    <nav class="msg-folder-tab-bar" aria-label="Message folders">
                        <button type="button" class="msg-folder-tab active" data-msg-folder="inbox" onclick="activateMessagesFolder('inbox', event)">Inbox</button>
                        <button type="button" class="msg-folder-tab" data-msg-folder="drafts" onclick="activateMessagesFolder('drafts', event)">Drafts</button>
                        <button type="button" class="msg-folder-tab" data-msg-folder="sent" onclick="activateMessagesFolder('sent', event)">Sent</button>
                    </nav>
                    <div class="msg-folder-panel msg-folder-panel-active" id="msg-folder-panel-inbox" data-msg-folder-panel="inbox">
                        <div class="msg-portal-toolbar">
                            <button class="settings-btn mini-btn" id="msg-multi-delete-toggle" onclick="toggleMassDeletionMode('inbox')">Delete Multiple</button>
                            <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="msg-select-all-btn" onclick="executeSelectAllMessageCheckboxes('inbox')">Select All</button>
                            <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="msg-confirm-delete-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="executeMassDossierPurge('inbox')">Delete selected</button>
                        </div>
                        <div class="msg-portal-scroll-bin" id="msg-inbox-render-dock"></div>
                    </div>
                    <div class="msg-folder-panel msg-folder-panel-hidden" id="msg-folder-panel-drafts" data-msg-folder-panel="drafts">
                        <div class="msg-portal-scroll-bin" id="msg-drafts-render-dock"></div>
                    </div>
                    <div class="msg-folder-panel msg-folder-panel-hidden" id="msg-folder-panel-sent" data-msg-folder-panel="sent">
                        <div class="msg-portal-toolbar">
                            <button class="settings-btn mini-btn" id="sent-multi-delete-toggle" onclick="toggleMassDeletionMode('sent')">Delete Multiple</button>
                            <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="sent-select-all-btn" onclick="executeSelectAllMessageCheckboxes('sent')">Select All</button>
                            <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="sent-confirm-delete-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="executeMassDossierPurge('sent')">Delete selected</button>
                        </div>
                        <div class="msg-portal-scroll-bin" id="msg-sent-render-dock"></div>
                    </div>
                </div>
            `
        },
        {
            name: "System Messages",
            detail: `
                <div class="message-workspace-canvas">
                    <div class="msg-portal-toolbar">
                        <!-- FIXED TARGET EXTENSION ID MATCHED DIRECTLY TO RENDERER -->
                        <button class="settings-btn mini-btn" id="sys-multi-delete-toggle" onclick="toggleMassDeletionMode('system')">Delete Multiple</button>
                        <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="sys-select-all-btn" onclick="executeSelectAllMessageCheckboxes('system')">Select All</button>
                        <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="sys-confirm-delete-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="executeMassDossierPurge('system')">Delete selected</button>
                    </div>
                    <div class="msg-portal-scroll-bin" id="msg-system-render-dock"></div>
                </div>
            `
        },
    ],

       /* --- Block 17: System Settings Framework --- */
            settings: [
            {
                name: "Visuals & Interface",
                detail: `
                    <!-- SCROLL CONTAINER TO SEPARATE FIELDS FROM BOTTOM BUTTONS -->
                    <div class="settings-scroll-wrapper">
                        <!-- ISOLATED INTERFACE LIVE PREVIEW MONITOR -->
                        <div class="preview-sandbox-window">
                            <div class="preview-sandbox-label">Interface live preview</div>
                            <!-- THE FRAME CONTAINER: Sized 320x160 with your thin border graphic -->
                            <div class="preview-landing-backdrop">
                                <!-- THE BACKGROUND GRAPHIC: Holds the mainbg1 landscape image -->
                                <div id="preview-backdrop-zone" class="preview-landscape-layer"></div>
                                <!-- THE STONE WHEEL: Floats safely on top of everything -->
                                <div id="preview-modal-frame" class="preview-mini-modal"></div>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">Interface Scaling</label>
                            <div class="settings-right-wrapper">
                                <input type="range" min="0.5" max="1.2" step="0.1" value="1" id="ui-scale-slider" oninput="stageUIScale(this.value)">
                                <span id="scale-value" class="settings-value-label">100%</span>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">Text Size</label>
                            <div class="settings-right-wrapper">
                                <input type="range" min="0.75" max="1.5" step="0.05" value="1" id="text-scale-slider" oninput="stageTextScale(this.value)">
                                <span id="text-scale-value" class="settings-value-label">100%</span>
                            </div>
                        </div>
                        <p class="settings-hint-line">Scales all in-game text proportionally — headings stay larger than body copy.</p>

                        <div class="settings-group">
                            <label class="settings-label">High Contrast Setting (Photophobia)</label>
                            <div class="settings-right-wrapper">
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="hc-toggle-check" onclick="toggleHighContrast()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">Accessibility Setting (Dyslexia)</label>
                            <div class="settings-right-wrapper">
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="font-toggle-check" onclick="toggleDyslexiaFont()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                `
            },
            {
            name: "Audio & Narration",
            detail: `
                <div class="settings-scroll-wrapper">
                    <div class="settings-group">
                        <label class="settings-label">Master Volume</label>
                        <div class="settings-right-wrapper">
                            <input type="range" min="0" max="1" step="0.05" value="1" class="settings-slider" id="master-vol-slider" oninput="stageAudioVolume()">
                        </div>
                    </div>
                    
                    <div class="settings-group">
                        <label class="settings-label">Background Music</label>
                        <div class="settings-right-wrapper">
                            <!-- NEW MUSIC SLIDER: Calls mixing logic and fires a live sample track audio preview -->
                            <input type="range" min="0" max="1" step="0.05" value="0.5" class="settings-slider" id="music-vol-slider" oninput="stageAudioVolume(); playLiveAudioPreview('music')">
                        </div>
                    </div>
                    
                    <div class="settings-group">
                        <label class="settings-label">Narration Stream Volume</label>
                        <div class="settings-right-wrapper">
                            <!-- UPDATED NARRATION SLIDER: Fires a live voice text track audio preview -->
                            <input type="range" min="0" max="1" step="0.05" value="1" class="settings-slider" id="narration-vol-slider" oninput="stageAudioVolume(); playLiveAudioPreview('narration')">
                        </div>
                    </div>
                    
                    <div class="settings-group">
                        <label class="settings-label">Interface SFX Volume</label>
                        <div class="settings-right-wrapper">
                            <!-- UPDATED SFX SLIDER: Fires a live mechanical sound effect track audio preview -->
                            <input type="range" min="0" max="1" step="0.05" value="0.2" class="settings-slider" id="sfx-vol-slider" oninput="stageAudioVolume(); playLiveAudioPreview('sfx')">
                        </div>
                    </div>
                </div>
            `
        },
            {
                name: "Gameplay & Strategy",
                detail: `
                    <div class="settings-scroll-wrapper">
                        <div class="settings-group">
                            <label class="settings-label">Battle Log Verbosity</label>
                            <div class="settings-right-wrapper">
                                <span class="toggle-label-text" id="verbosity-label-text">Detailed</span>
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="verbosity-toggle-check" onclick="toggleVerbosity()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">Real-Time Attack Pings</label>
                            <div class="settings-right-wrapper">
                                <span class="toggle-label-text" id="pings-label-text">Enabled</span>
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="pings-toggle-check" onclick="toggleAttackPings()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">Confirm risky actions</label>
                            <div class="settings-right-wrapper">
                                <span class="toggle-label-text" id="lock-label-text">Double</span>
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="lock-toggle-check" onclick="toggleSafetyLock()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <label class="settings-label">In-Game Chat Transparency</label>
                            <div class="settings-right-wrapper">
                                <input type="range" min="15" max="100" step="5" value="85" class="settings-slider" id="game-chat-opacity-slider" oninput="stageGameChatOpacity(this.value)">
                                <span id="game-chat-opacity-value" class="settings-value-label">85%</span>
                            </div>
                        </div>
                        <p class="settings-hint-line">Adjusts the Age session chat panel background opacity (15%–100%).</p>
                    </div>
                `
            },
        ],
        /* ============================================================
           /* Block 18: NEW COMMANDER PROFILE REPOSITORY DATA MODULE
           ============================================================ */
        profile: [
            {
                name: "PROFILE_FULLSCREEN_MODE",
                detail: `
                    <div class="settings-scroll-wrapper profile-fullscreen-canvas">
                        
                        <!-- MIDDLE MESH CORE: BIOGRAPHY & ALLIANCES SIDE-BY-SIDE -->
                        <div class="profile-fullscreen-split-row">
                            <div class="profile-split-panel-half">
                                
                                <!-- 🛑 ACTIVE PENALTIES CONTAINER COMPLETELY REMOVED FROM PERSONAL TERMINAL VIEW -->

                                <!-- DESCRIPTION BIOGRAPHY BOX WITH THIN GOLDEN BEZEL SKIN -->
                                <div class="profile-section-box">
                                    <label class="settings-label">Player Bio</label>
                                    <!-- THE BEZEL CONTAINER INNER BACKGROUND WRAPPER -->
                                    <div class="bio-bezel-frame-wrapper">
                                        <textarea id="profile-bio-input" maxlength="250" placeholder="Write a short bio about yourself..." oninput="hasUnsavedChanges=true; player.description=this.value;">\${player.description}</textarea>
                                    </div>
                                </div>
                                
                                <!-- PRIVACY CONTROL SLIDER SWITCH -->
                                <div class="profile-section-box">
                                    <label class="settings-label">Profile View</label>
                                    <div class="profile-field-row">
                                        <span class="toggle-label-text" id="privacy-label-text" style="text-align: left;">Visibility: <strong>\${player.privacy}</strong></span>
                                        <label class="switch-toggle-bar">
                                            <input type="checkbox" id="privacy-toggle-check" \${player.privacy === 'Public' ? 'checked' : ''} onclick="toggleProfilePrivacy()">
                                            <div class="toggle-slider-track"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="profile-split-panel-half">
                                <!-- LIST MANAGEMENT TABS -->
                                <div class="profile-double-row">
                                    <div class="social-list-box">
                                        <label class="settings-label">Friends List</label>
                                        <div class="social-scroll-bin" id="friends-list-bin">
                                            <!-- FIXED EVALUATION TRACK PATH LINK -->
                                            \${player.friends.map(f => \`<div class="social-item-row">🛡️ \${f}</div>\`).join('')}
                                        </div>
                                    </div>
                                    <div class="social-list-box">
                                        <label class="settings-label">Blocked List</label>
                                        <div class="social-scroll-bin" id="blocked-list-bin">
                                            <!-- FIXED EVALUATION TRACK PATH LINK -->
                                            \${player.blocked.map(b => \`<div class="social-item-row blocked-txt">❌ \${b}</div>\`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- BOTTOM DASHBOARD: SECURITY, SIMULATION & RISK MANAGEMENT -->
                        <div class="profile-fullscreen-footer-deck">
                            <div class="profile-section-box footer-box-third">
                                <label class="settings-label">Login Information</label>
                                <div class="profile-btn-row-stacked">
                                    <button class="settings-btn" onclick="manageSecurityUpdate('email')">Update Email Address</button>
                                    <button class="settings-btn" onclick="manageSecurityUpdate('password')">Change password</button>
                                </div>
                            </div>
                            
                            <div class="profile-section-box footer-box-third critical-danger-zone">
                                <label class="settings-label warning-title">Rank Reset</label>
                                <div class="profile-btn-row-stacked">
                                    <button type="button" class="danger-action-btn rank-reset-action-btn" data-commander-reset-mode="rank" onclick="triggerCommanderSuicide('rank')">Secede Rank</button>
                                    <button type="button" class="danger-action-btn rank-reset-action-btn" data-commander-reset-mode="exile" onclick="triggerCommanderSuicide('exile')">Suicide out of Country</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            }
        ]
    };

    /* ============================================================
   /* Block 19: HARDWARE GEOLOCATION & TIMEZONE AUTO-DETECTION
   ============================================================ */
function autoDetectPlayerLocale() {
    try {
        // 1. Extract the specific regional timezone string natively from the hardware system clock
        const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g., "America/New_York"
        
        // 2. CALCULATE EXACT GMT OFFSET VALUE IN PARENTHESES
        const now = new Date();
        const offsetMinutes = -now.getTimezoneOffset(); // Reverse the sign to align with standard GMT notation
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const remainingMinutes = Math.abs(offsetMinutes) % 60;
        
        // Format the numbers cleanly (e.g., "GMT+5", "GMT-4", or "GMT+5:30")
        const sign = offsetMinutes >= 0 ? "+" : "-";
        const formattedMinutes = remainingMinutes > 0 ? `:${remainingMinutes.toString().padStart(2, '0')}` : "";
        const gmtString = `GMT${sign}${offsetHours}${formattedMinutes}`;
        
        // 3. PARSE CONTINENTAL REGION AND EXTRACT STATE / REGION TITLE
        if (systemTimeZone && systemTimeZone.includes('/')) {
            const zoneParts = systemTimeZone.split('/');
            const regionNode = zoneParts[0]; // e.g., "America", "Europe"
            
            // Replaces underscores with clean text spacing (e.g., "New_York" -> "New York")
            let stateOrRegionTitle = zoneParts[1].replace(/_/g, ' '); 
            
            // Sync the structured Timezone string: "State/City (GMT+/-X)"
            player.timezone = `${stateOrRegionTitle} (${gmtString})`;
            
            // CLEAN CONTINENTAL SEGMENT FILTERING
            if (regionNode === "America") {
                const southAmericanCities = ["Sao_Paulo", "Buenos_Aires", "Santiago", "Bogota", "Lima", "Caracas", "Asuncion", "Montevideo", "La_Paz"];
                if (southAmericanCities.includes(zoneParts[1])) {
                    player.country = "South America";
                } else {
                    player.country = "North America";
                }
            } else if (regionNode === "Europe") {
                player.country = "Europe";
            } else if (regionNode === "Asia") {
                player.country = "Asia";
            } else if (regionNode === "Africa") {
                player.country = "Africa";
            } else if (regionNode === "Australia" || regionNode === "Pacific") {
                player.country = "Oceania";
            } else if (regionNode === "Atlantic" || regionNode === "Indian") {
                player.country = "Global Sector";
            } else {
                player.country = regionNode;
            }
        } else {
            player.country = "Global Sector";
            player.timezone = `Local Time (${gmtString})`;
        }
        
        console.log(`Locale Engine Synced: ${player.country} | ${player.timezone}`);
    } catch (error) {
        console.error("Locale mapping loop bypass active:", error);
        player.country = "Global Sector";
        player.timezone = "Local Time (GMT+0)";
    }

    if (typeof persistCommanderLocaleToServer === 'function') {
        persistCommanderLocaleToServer();
    }
}

function persistCommanderLocaleToServer() {
    if (typeof player === 'undefined' || !player) return;
    const country = String(player.country || '').trim();
    const timezone = String(player.timezone || '').trim();
    if (!country && !timezone) return;

    const username = typeof getActiveCommanderUsername === 'function'
        ? getActiveCommanderUsername()
        : (localStorage.getItem('activeCommanderUser') || '');
    if (!username || String(username).trim().toLowerCase() === 'testaccount') return;

    if (typeof scheduleCommanderDossierSave === 'function') {
        scheduleCommanderDossierSave({ country, timezone });
    }
}

async function syncCommanderLocaleAfterAuth() {
    if (typeof autoDetectPlayerLocale === 'function') {
        autoDetectPlayerLocale();
    }

    if (typeof player === 'undefined' || !player) return;

    const country = String(player.country || '').trim();
    const timezone = String(player.timezone || '').trim();
    if (!country && !timezone) return;

    const username = typeof getActiveCommanderUsername === 'function'
        ? getActiveCommanderUsername()
        : (localStorage.getItem('activeCommanderUser') || '');
    if (!username || String(username).trim().toLowerCase() === 'testaccount') return;

    if (typeof scheduleCommanderDossierSave === 'function') {
        await scheduleCommanderDossierSave({ country, timezone }, { immediate: true });
    }
}

window.persistCommanderLocaleToServer = persistCommanderLocaleToServer;
window.syncCommanderLocaleAfterAuth = syncCommanderLocaleAfterAuth;

function getDefaultLoreUIMount() {
    return {
        container: document.getElementById('lore-titles-container'),
        body: document.getElementById('lore-details-body'),
        detailsHeader: document.querySelector('.lore-pane-right .pane-label'),
        leftHeader: document.querySelector('.lore-pane-left .pane-label'),
        modalFrame: document.getElementById('lore-modal'),
        profileHeaderHost: null,
        profileFooterHost: null,
        profileActiveClass: 'fullscreen-profile-active-state',
        subnavItemClass: 'update-item',
        hideSubnavOnProfile: true
    };
}

function resolveLoreUIMount(customMount) {
    return { ...getDefaultLoreUIMount(), ...(customMount || {}) };
}

function getActiveSettingsBodyElement() {
    return document.getElementById('portal-commander-hub-body')
        || document.getElementById('commander-hub-body')
        || document.getElementById('lore-details-body');
}

function reloadProfilePanelView() {
    const hubFrame = typeof getActiveCommanderHubFrame === 'function'
        ? getActiveCommanderHubFrame()
        : null;
    if (hubFrame) {
        if (typeof loadCommanderHubSection === 'function') loadCommanderHubSection('profile');
        return;
    }
    if (typeof loadLore === 'function') loadLore('profile');
}

function reloadMessagesPanelView() {
    const hubFrame = typeof getActiveCommanderHubFrame === 'function'
        ? getActiveCommanderHubFrame()
        : null;
    if (hubFrame) {
        if (typeof loadCommanderHubSection === 'function') {
            window.pendingMessagesHubChannel = 'messages';
            window.pendingMessagesFolder = activeMessagesFolder || 'inbox';
            loadCommanderHubSection('messages');
        }
        return;
    }
    if (typeof loadLore === 'function') loadLore('messages');
}

function normalizeMessagesHubChannelKey(trackKey) {
    if (trackKey === 'inbox' || trackKey === 'drafts' || trackKey === 'sent') {
        return { channel: 'messages', folder: trackKey };
    }
    if (trackKey === 'messages') {
        return { channel: 'messages', folder: activeMessagesFolder || 'inbox' };
    }
    return { channel: trackKey, folder: null };
}

function activateMessagesFolder(folderKey, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const allowed = ['inbox', 'drafts', 'sent'];
    activeMessagesFolder = allowed.includes(folderKey) ? folderKey : 'inbox';

    document.querySelectorAll('.msg-folder-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.msgFolder === activeMessagesFolder);
    });

    document.querySelectorAll('.msg-folder-panel').forEach((panel) => {
        const isActive = panel.dataset.msgFolderPanel === activeMessagesFolder;
        panel.classList.toggle('msg-folder-panel-active', isActive);
        panel.classList.toggle('msg-folder-panel-hidden', !isActive);
    });

    if (isMassDeletionActive.inbox && activeMessagesFolder !== 'inbox') {
        isMassDeletionActive.inbox = false;
    }
    if (isMassDeletionActive.sent && activeMessagesFolder !== 'sent') {
        isMassDeletionActive.sent = false;
    }

    fetchCommanderMailboxFromServer().finally(() => renderDossierPortalListHTML(activeMessagesFolder));
}

function activateMessagesHubChannel(trackKey, mount, activeBtn) {
    const body = mount.body;
    const container = mount.container;
    const leftHeader = mount.leftHeader;
    const detailsHeader = mount.detailsHeader;
    const subnavItemClass = mount.subnavItemClass;

    const normalized = normalizeMessagesHubChannelKey(trackKey);
    const resolvedTrackKey = normalized.channel;
    if (normalized.folder) activeMessagesFolder = normalized.folder;

    const tabNamesMapping = ['Send Message', 'Messages', 'System Messages'];
    const trackIdentifiers = ['send', 'messages', 'system'];
    const channelIndex = trackIdentifiers.indexOf(resolvedTrackKey);
    const tabLabel = tabNamesMapping[channelIndex >= 0 ? channelIndex : 1] || 'Messages';

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    markHubChannelTabActive(activeBtn, container);

    if (body) body.innerHTML = nationLore.messages[channelIndex >= 0 ? channelIndex : 1].detail;

    if (leftHeader) leftHeader.innerText = 'CHANNELS';
    if (detailsHeader) detailsHeader.innerHTML = tabLabel.toUpperCase();

    if (resolvedTrackKey === 'messages') {
        clearMessageComposeContext();
        fetchCommanderMailboxFromServer().finally(() => {
            activateMessagesFolder(activeMessagesFolder || 'inbox');
        });
    } else if (resolvedTrackKey === 'system') {
        clearMessageComposeContext();
        fetchCommanderMailboxFromServer().finally(() => renderDossierPortalListHTML('system'));
    } else {
        const drawer = document.getElementById('msg-directory-floating-drawer');
        if (drawer) drawer.className = 'msg-floating-drawer-hidden';
        if (!messageComposeApplyingFromDossier) {
            clearMessageComposeContext();
        }
    }
}

function isCommanderHubPortalSubnavCompact() {
    return typeof isCommanderHubPortalPageActive === 'function' && isCommanderHubPortalPageActive();
}

function getCommanderHubCompactSubnavLabel(label) {
    if (!isCommanderHubPortalSubnavCompact()) return label;

    const shortLabels = {
        'Send Message': 'Send',
        'Messages': 'Mail',
        'System Messages': 'System',
        'Visuals & Interface': 'Visuals',
        'Audio & Narration': 'Audio',
        'Gameplay & Strategy': 'Gameplay'
    };

    return shortLabels[label] || label;
}

function mountMessagesHubView(mount, preferredChannel) {
    const body = mount.body;
    const container = mount.container;
    const leftHeader = mount.leftHeader;
    const detailsHeader = mount.detailsHeader;
    const subnavItemClass = mount.subnavItemClass;

    if (!body || !container) return;

    const tabNamesMapping = ['Send Message', 'Messages', 'System Messages'];
    const trackIdentifiers = ['send', 'messages', 'system'];

    let startFolder = 'inbox';
    let startChannel = 'messages';
    if (preferredChannel === 'inbox' || preferredChannel === 'drafts' || preferredChannel === 'sent') {
        startFolder = preferredChannel;
        startChannel = 'messages';
    } else if (trackIdentifiers.includes(preferredChannel)) {
        startChannel = preferredChannel;
    } else if (preferredChannel === 'system') {
        startChannel = 'system';
    }

    if (window.pendingMessagesFolder) {
        startFolder = window.pendingMessagesFolder;
        startChannel = 'messages';
        window.pendingMessagesFolder = null;
    }

    activeMessagesFolder = startFolder;
    const startIndex = trackIdentifiers.indexOf(startChannel);

    if (leftHeader) leftHeader.innerText = 'CHANNELS';
    if (detailsHeader) detailsHeader.innerHTML = tabNamesMapping[startIndex].toUpperCase();

    const centerWheelLabelDisplay = document.getElementById('slot-label-display');
    if (centerWheelLabelDisplay) centerWheelLabelDisplay.innerText = 'MESSAGES';

    body.innerHTML = nationLore.messages[startIndex].detail;
    container.innerHTML = '';

    const channelButtons = [];

    trackIdentifiers.forEach((trackKey, idx) => {
        const btn = document.createElement('div');
        btn.className = subnavItemClass;
        btn.dataset.msgChannel = trackKey;
        btn.innerText = getCommanderHubCompactSubnavLabel(tabNamesMapping[idx]);
        btn.onclick = () => activateMessagesHubChannel(trackKey, mount, btn);
        container.appendChild(btn);
        channelButtons.push({ trackKey, btn });
    });

    const defaultEntry = channelButtons.find((entry) => entry.trackKey === startChannel) || channelButtons[1];
    if (defaultEntry) {
        defaultEntry.btn.classList.add('active');
        window.setTimeout(() => {
            activateMessagesHubChannel(defaultEntry.trackKey, mount, defaultEntry.btn);
        }, 0);
    }

    window.setTimeout(() => {
        const drawer = document.getElementById('msg-directory-floating-drawer');
        if (drawer) drawer.className = 'msg-floating-drawer-hidden';
        if (typeof syncRecipientDirectoryMobilePresentation === 'function') {
            syncRecipientDirectoryMobilePresentation(false);
        }
        fetchCommanderMailboxFromServer().then(() => {
            if (startChannel === 'messages') {
                activateMessagesFolder(startFolder);
            } else {
                renderDossierPortalListHTML('system');
            }
            syncNavMailboxIndicators();
        });
        loadMailboxAdminRecipientRoster().then(() => {
            renderRecipientDrawerRootCategories();
        });
    }, 15);
}

function isCommanderEnrolledInActiveAgeRound() {
    return localStorage.getItem('savedCommanderInActiveAge') === 'true';
}

const COMMANDER_RANK_RESET_LIMIT = 3;
const COMMANDER_EXILE_RESET_LIMIT = 1;
const COMMANDER_AGE_RESET_USAGE_KEY = 'savedCommanderAgeResetUsage';
const COMMANDER_ACTIVE_AGE_SESSION_KEY = 'savedCommanderActiveAgeSessionKey';

function resolveCommanderResetStorageKey() {
    const name = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    if (name && name.trim()) return name.trim().toLowerCase();
    const saved = localStorage.getItem('activeCommanderUser');
    return saved && saved.trim() ? saved.trim().toLowerCase() : '';
}

function loadCommanderAgeResetStore() {
    try {
        const raw = localStorage.getItem(COMMANDER_AGE_RESET_USAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        return {};
    }
}

function saveCommanderAgeResetStore(store) {
    localStorage.setItem(COMMANDER_AGE_RESET_USAGE_KEY, JSON.stringify(store || {}));
    if (typeof scheduleCommanderDossierSave === 'function') {
        scheduleCommanderDossierSave({ ageResetUsage: store || {} });
    }
}

function createFreshCommanderAgeResetEntry(sessionKey) {
    return {
        sessionKey,
        rankResetsUsed: 0,
        exileResetsUsed: 0
    };
}

function getCommanderAgeResetEntry() {
    const userKey = resolveCommanderResetStorageKey();
    const sessionKey = localStorage.getItem(COMMANDER_ACTIVE_AGE_SESSION_KEY);
    if (!userKey || !sessionKey) {
        return { rankResetsUsed: 0, exileResetsUsed: 0, sessionKey: sessionKey || null };
    }

    const store = loadCommanderAgeResetStore();
    const entry = store[userKey];
    if (!entry || entry.sessionKey !== sessionKey) {
        return { rankResetsUsed: 0, exileResetsUsed: 0, sessionKey };
    }

    return entry;
}

function getCommanderResetLimit(mode) {
    return mode === 'exile' ? COMMANDER_EXILE_RESET_LIMIT : COMMANDER_RANK_RESET_LIMIT;
}

function getCommanderResetRemaining(mode) {
    const entry = getCommanderAgeResetEntry();
    const used = mode === 'exile' ? entry.exileResetsUsed : entry.rankResetsUsed;
    return Math.max(0, getCommanderResetLimit(mode) - used);
}

function canUseCommanderReset(mode) {
    if (mode !== 'rank' && mode !== 'exile') return true;
    if (!isCommanderEnrolledInActiveAgeRound()) return false;
    return getCommanderResetRemaining(mode) > 0;
}

function incrementCommanderResetUsage(mode) {
    if (mode !== 'rank' && mode !== 'exile') return;

    const userKey = resolveCommanderResetStorageKey();
    if (!userKey) return;

    let sessionKey = localStorage.getItem(COMMANDER_ACTIVE_AGE_SESSION_KEY);
    if (!sessionKey) {
        sessionKey = `age-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(COMMANDER_ACTIVE_AGE_SESSION_KEY, sessionKey);
    }

    const store = loadCommanderAgeResetStore();
    const existing = store[userKey];
    const entry = (existing && existing.sessionKey === sessionKey)
        ? existing
        : createFreshCommanderAgeResetEntry(sessionKey);

    if (mode === 'exile') {
        entry.exileResetsUsed = Math.min(COMMANDER_EXILE_RESET_LIMIT, entry.exileResetsUsed + 1);
    } else {
        entry.rankResetsUsed = Math.min(COMMANDER_RANK_RESET_LIMIT, entry.rankResetsUsed + 1);
    }

    store[userKey] = entry;
    saveCommanderAgeResetStore(store);
}

function beginCommanderAgeResetSession() {
    const userKey = resolveCommanderResetStorageKey();
    if (!userKey) return;

    const wasPlaying = localStorage.getItem('savedCommanderInActiveAge') === 'true';
    const existingKey = localStorage.getItem(COMMANDER_ACTIVE_AGE_SESSION_KEY);
    const store = loadCommanderAgeResetStore();
    const entry = store[userKey];

    if (wasPlaying && existingKey && entry && entry.sessionKey === existingKey) {
        return;
    }

    const sessionKey = `age-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(COMMANDER_ACTIVE_AGE_SESSION_KEY, sessionKey);
    store[userKey] = createFreshCommanderAgeResetEntry(sessionKey);
    saveCommanderAgeResetStore(store);
}

function ensureCommanderAgeResetSessionContinuity() {
    if (!isCommanderEnrolledInActiveAgeRound()) return;

    const userKey = resolveCommanderResetStorageKey();
    if (!userKey) return;

    let sessionKey = localStorage.getItem(COMMANDER_ACTIVE_AGE_SESSION_KEY);
    if (!sessionKey) {
        sessionKey = `age-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(COMMANDER_ACTIVE_AGE_SESSION_KEY, sessionKey);
    }

    const store = loadCommanderAgeResetStore();
    const entry = store[userKey];
    if (!entry || entry.sessionKey !== sessionKey) {
        store[userKey] = createFreshCommanderAgeResetEntry(sessionKey);
        saveCommanderAgeResetStore(store);
    }
}

function clearCommanderAgeResetSession() {
    localStorage.removeItem(COMMANDER_ACTIVE_AGE_SESSION_KEY);
}

function getCommanderResetButtonTitle(mode) {
    const limit = getCommanderResetLimit(mode);
    const remaining = getCommanderResetRemaining(mode);

    if (!isCommanderEnrolledInActiveAgeRound()) {
        return 'Available only while actively playing an Age.';
    }

    if (remaining <= 0) {
        return mode === 'exile'
            ? `Suicide reset already used for this Age (${limit} per Age).`
            : `All rank resets used for this Age (${limit} per Age).`;
    }

    return mode === 'exile'
        ? `${remaining} of ${limit} suicide reset remaining this Age.`
        : `${remaining} of ${limit} rank resets remaining this Age.`;
}

function markHubChannelTabActive(activeBtn, container) {
    if (!container) return;
    container.querySelectorAll('.commander-hub-subnav-item, .update-item').forEach((tab) => {
        tab.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
}

function applyProfileRankResetButtonState() {
    document.querySelectorAll('.rank-reset-action-btn, [data-commander-reset-mode]').forEach((btn) => {
        const mode = btn.dataset.commanderResetMode;
        if (mode !== 'rank' && mode !== 'exile') return;

        const allowed = canUseCommanderReset(mode);
        btn.disabled = !allowed;
        btn.classList.toggle('rank-reset-disabled', !allowed);
        btn.setAttribute('aria-disabled', allowed ? 'false' : 'true');
        btn.title = getCommanderResetButtonTitle(mode);
    });
}

function loadLore(type, customMount) {
    syncPlayerFromActiveCommanderStorage();

    const mount = resolveLoreUIMount(customMount);
    const container = mount.container;
    const body = mount.body;
    const detailsHeader = mount.detailsHeader;
    const leftHeader = mount.leftHeader;
    const modalFrame = mount.modalFrame;
    const profileActiveClass = mount.profileActiveClass;
    const subnavItemClass = mount.subnavItemClass;

    if (!body) return;
    if (!container && type !== 'profile') return;

    if (container) container.innerHTML = "";
    body.innerHTML = "Select an option";
    
    // 🛑 THE RIGHT PANELS HEADER LOCK: Stays blank on boot up until a choice clicks!
    if (detailsHeader) detailsHeader.innerHTML = "";
    
    // 🛡️ THE LEFT PANELS RESTORATION HOOK: Returns text instantly to the left pane header
    if (leftHeader) {
        leftHeader.innerHTML = (type === 'settings') ? "SETTINGS" : "COMMANDER";
    }

    if (type === 'archives' || type === 'manuscripts' || type === 'letters' || type === 'nations') {
        body.innerHTML = '<p style="padding:12px;">Nation chronicles and audio narration are on the <strong>Age Portal</strong>. Log in and open the <strong>Lore</strong> tab.</p>';
        return;
    }
    
    const oldHeader = document.getElementById('profile-extracted-header-banner');
    if (oldHeader) oldHeader.remove();
    const oldFooter = document.getElementById('profile-fullscreen-action-footer');
    if (oldFooter) oldFooter.remove();
    if (mount.profileHeaderHost) mount.profileHeaderHost.innerHTML = '';
    if (mount.profileFooterHost) mount.profileFooterHost.innerHTML = '';
    
    if (modalFrame) {
        modalFrame.classList.remove(profileActiveClass);
    }
    if (detailsHeader) detailsHeader.style.display = 'block';
    if (leftHeader) leftHeader.style.display = 'block';

    // ==========================================================================
    // 📬 INTERCEPT INTEGRATION 1: STANDALONE TACTICAL MESSAGES SUB-TAB CONNECTIONS
    // ==========================================================================
    if (type === 'messages') {
        mountMessagesHubView(mount, window.pendingMessagesHubChannel || 'messages');
        window.pendingMessagesHubChannel = null;
        return;
    }
    
    // ==========================================================================
    // 👤 INTERCEPT INTEGRATION 2: COMMANDER CUSTOMIZATION DASHBOARD WINDOW
    // ==========================================================================
    if (type === 'profile' || (nationLore[type] && nationLore[type].name === "PROFILE_FULLSCREEN_MODE") || (nationLore[type] && nationLore[type][0] && nationLore[type][0].name === "PROFILE_FULLSCREEN_MODE")) {
            syncPlayerFromActiveCommanderStorage();
            if (modalFrame) modalFrame.classList.add(profileActiveClass);
            if (detailsHeader) detailsHeader.style.display = 'none';
            if (leftHeader) leftHeader.style.display = 'none';
            
            const friendsListHTML = player.friends.length > 0
                ? player.friends.map(f => `
                    <div class="alliance-capsule-badge" title="Friend: ${f}">
                        <span class="capsule-icon-shield">🛡️</span>
                        <span class="capsule-username-text">${f}</span>
                    </div>
                `).join('')
                : `<div class="empty-roster-txt">No friends added yet.</div>`;
                
            const blockedListHTML = player.blocked.length > 0
                ? player.blocked.map(b => `
                    <div class="alliance-capsule-badge capsule-exiled-border" title="Blocked player: ${b}">
                        <span class="capsule-icon-shield">❌</span>
                        <span class="capsule-username-text blocked-txt">${b}</span>
                    </div>
                `).join('')
                : `<div class="empty-roster-txt">No blocked players.</div>`;
                
            const headerHost = mount.profileHeaderHost;
            const paneRight = headerHost || body.parentElement;
            if (paneRight) {
                if (headerHost) headerHost.innerHTML = '';
                const topHeaderCard = document.createElement('div');
                topHeaderCard.id = 'profile-extracted-header-banner';
                topHeaderCard.className = 'profile-fullscreen-header-card';
                topHeaderCard.innerHTML = `
                    <div class="avatar-frame-container" id="avatar-master-viewbox">
                        <div id="avatar-active-display-group">
                            <img id="profile-avatar-display" src="${player.avatarUrl}" alt="Avatar" class="clickable-avatar-badge" onclick="openAvatarArmorySelector(event)">
                        </div>
                    </div>
                    <div class="profile-header-identity-group">
                        <div class="profile-identity-title-row">
                            <span class="profile-main-name">${player.name}</span>
                            <div class="commander-membership-badge-row profile-identity-badge-row">${
                                typeof buildCommanderMembershipBadgeRowMarkup === 'function'
                                    ? buildCommanderMembershipBadgeRowMarkup(player.name)
                                    : `<span class="membership-badge tier-${player.membershipTitle.toLowerCase()}">${player.membershipTitle} Member</span>`
                            }</div>
                        </div>
                        <div class="profile-identity-sub-row">
                            <span>Region: <strong>${player.country}</strong></span>
                            <span>Time Zone: <strong>${player.timezone}</strong></span>
                        </div>
                    </div>
                `;
                if (headerHost) {
                    headerHost.appendChild(topHeaderCard);
                } else {
                    paneRight.insertBefore(topHeaderCard, body);
                }
            }
            
            body.innerHTML = `
                <div class="settings-scroll-wrapper profile-fullscreen-canvas">
                    <div class="profile-fullscreen-split-row">
                        <div class="profile-split-panel-half">
                            <div class="profile-avatar-armory-slot" id="profile-avatar-armory-slot" aria-label="Avatar library">
                                <div id="avatar-preset-selection-bin" class="profile-avatar-preset-bin" hidden>
                                    <div class="avatar-selection-header">Choose avatar</div>
                                    <div class="avatar-thumbnail-grid">
                                        <img src="images/avatars/commanderprofile01.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile01.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile01.png')">
                                        <img src="images/avatars/commanderprofile02.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile02.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile02.png')">
                                        <img src="images/avatars/commanderprofile03.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile03.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile03.png')">
                                        <img src="images/avatars/commanderprofile04.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile04.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile04.png')">
                                        <img src="images/avatars/commanderprofile05.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile05.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile05.png')">
                                        <img src="images/avatars/commanderprofile06.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile06.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile06.png')">
                                        <img src="images/avatars/commanderprofile07.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile07.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile07.png')">
                                        <img src="images/avatars/commanderprofile08.png" class="avatar-thumb-lever ${player.avatarUrl === 'images/avatars/commanderprofile08.png' ? 'selected-avatar-border' : ''}" onclick="selectPresetAvatar('images/avatars/commanderprofile08.png')">
                                    </div>
                                    <button type="button" class="settings-btn mini-btn close-armory-btn" onclick="closeAvatarArmorySelector(event)">Return</button>
                                </div>
                            </div>
                            <div class="profile-section-box">
                                <label class="settings-label">Player Bio</label>
                                <div class="bio-bezel-frame-wrapper">
                                    <textarea id="profile-bio-input" maxlength="250" placeholder="Write a short bio about yourself..." oninput="hasUnsavedChanges=true; player.description=this.value;" onchange="hasUnsavedChanges=true; player.description=this.value;">${player.description}</textarea>
                                </div>
                            </div>
                            <div class="profile-section-box">
                                <label class="settings-label">Profile View</label>
                                <div class="profile-field-row">
                                    <span class="toggle-label-text" id="privacy-label-text" style="text-align: left;">Visibility: <strong>${player.privacy}</strong></span>
                                    <label class="switch-toggle-bar">
                                        <input type="checkbox" id="privacy-toggle-check" ${player.privacy === 'Public' ? 'checked' : ''} onclick="toggleProfilePrivacy()">
                                        <div class="toggle-slider-track"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="profile-split-panel-half">
                            <div class="profile-double-row-expanded">
                                <div class="social-list-box-expanded">
                                    <label class="settings-label">Friends (${player.friends.length})</label>
                                    <div class="compact-grid-scroll-track" id="friends-list-bin">${friendsListHTML}</div>
                                </div>
                                <div class="social-list-box-expanded">
                                    <label class="settings-label">Blocked players (${player.blocked.length})</label>
                                    <div class="compact-grid-scroll-track" id="blocked-list-bin">${blockedListHTML}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="profile-fullscreen-footer-deck">
                        <div class="profile-section-box footer-box-third">
                            <label class="settings-label">Login Information</label>
                            <div class="profile-btn-row-stacked">
                                <button class="settings-btn" onclick="manageSecurityUpdate('email')">Update Email Address</button>
                                <button class="settings-btn" onclick="manageSecurityUpdate('password')">Change Password</button>
                            </div>
                        </div>
                        <div class="profile-section-box footer-box-third">
                            <label class="settings-label">Rank Reset</label>
                            <div class="profile-btn-row-stacked">
                                <button type="button" class="settings-btn rank-reset-action-btn" data-commander-reset-mode="rank" onclick="triggerCommanderSuicide('rank')">Secede Rank</button>
                                <button type="button" class="settings-btn rank-reset-action-btn" data-commander-reset-mode="exile" onclick="triggerCommanderSuicide('exile')">Suicide out of Country</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const profileFooter = document.createElement('div');
            profileFooter.id = 'profile-fullscreen-action-footer';
            profileFooter.className = 'settings-controls profile-fullscreen-controls';
            profileFooter.innerHTML = `
                <button type="button" class="confirm-btn">Save Changes</button>
                <button type="button" class="revert-btn">Undo Changes</button>
            `;
            const footerHost = mount.profileFooterHost || paneRight;
            if (footerHost) footerHost.appendChild(profileFooter);
            captureProfileEditorBaseline();
            bindProfileEditorFooterActions(profileFooter);
            applyProfileRankResetButtonState();
            return;
    }

    // ==========================================================================
    // ⚙️ SETTINGS LIST (index radial menu)
    // ==========================================================================
    if (type === 'settings' && nationLore.settings) {
        nationLore.settings.forEach(item => {
            const containerBox = container;
            if (!containerBox) return;

            const div = document.createElement('div');
            div.className = subnavItemClass;
            div.innerText = getCommanderHubCompactSubnavLabel(item.name);
            div.onclick = () => {
                markHubChannelTabActive(div, containerBox);
                body.innerHTML = item.detail;

                if (leftHeader) leftHeader.innerText = "SETTINGS";
                if (detailsHeader) detailsHeader.innerHTML = item.name.toUpperCase();

                if (type === 'settings') {
                    setTimeout(() => {
                        if (item.name === "Visuals & Interface") {
                            const slider = document.getElementById('ui-scale-slider');
                            if (slider) slider.value = confirmedScale;
                            stageUIScale(confirmedScale);
                            const textSlider = document.getElementById('text-scale-slider');
                            if (textSlider) textSlider.value = confirmedTextScale;
                            applyTextScaleToDocument(confirmedTextScale, { silent: true });
                            const hcCheck = document.getElementById('hc-toggle-check');
                            if (hcCheck) hcCheck.checked = document.body.classList.contains('high-contrast-mode');
                            const fontCheck = document.getElementById('font-toggle-check');
                            if (fontCheck) fontCheck.checked = isDyslexiaFontEnabled();
                            if (typeof applyPortalMobileVisualSettingsRestrictions === 'function') {
                                applyPortalMobileVisualSettingsRestrictions();
                            }
                        }
                        else if (item.name === "Audio & Narration") {
                            const masterSlider = document.getElementById('master-vol-slider');
                            const musicSlider = document.getElementById('music-vol-slider');
                            const narrationSlider = document.getElementById('narration-vol-slider');
                            const sfxSlider = document.getElementById('sfx-vol-slider');
                            if (masterSlider) masterSlider.value = confirmedMasterVol;
                            if (musicSlider) musicSlider.value = confirmedMusicVol;
                            if (narrationSlider) narrationSlider.value = confirmedNarrationVol;
                            if (sfxSlider) sfxSlider.value = confirmedSfxVol;
                        }
                        else if (item.name === "Gameplay & Strategy") {
                            const chatOpacitySlider = document.getElementById('game-chat-opacity-slider');
                            if (chatOpacitySlider) chatOpacitySlider.value = confirmedGameChatOpacity;
                            stagedGameChatOpacity = confirmedGameChatOpacity;
                            const chatOpacityLabel = document.getElementById('game-chat-opacity-value');
                            if (chatOpacityLabel) chatOpacityLabel.textContent = `${confirmedGameChatOpacity}%`;

                            const vCheck = document.getElementById('verbosity-toggle-check');
                            if (vCheck) vCheck.checked = (confirmedVerbosity === "Detailed");
                            const vText = document.getElementById('verbosity-label-text');
                            if (vText) vText.innerText = confirmedVerbosity;
                            const pCheck = document.getElementById('pings-toggle-check');
                            if (pCheck) pCheck.checked = (confirmedPings === "Enabled");
                            const pText = document.getElementById('pings-label-text');
                            if (pText) pText.innerText = confirmedPings;
                            const lCheck = document.getElementById('lock-toggle-check');
                            if (lCheck) lCheck.checked = (confirmedSafetyLock === "Double-Click");
                            const lText = document.getElementById('lock-label-text');
                            if (lText) lText.innerText = (confirmedSafetyLock === "Double-Click") ? "Double" : "Single";
                        }
                    }, 20);
                }
            };
            containerBox.appendChild(div);
        });

        if (container && container.firstElementChild) {
            container.firstElementChild.click();
        }
    }
}

function updateSlotLabel(text) {
    const display = document.getElementById('slot-label-display');
    console.log("Hovering over:", text); // Check your F12 console for this!
    
    if (display) {
        display.innerText = text;
        display.style.opacity = '1';
    } else {
        console.error("COULD NOT FIND slot-label-display ID!");
    }
}

/* --- Block 21: Unified Settings Controller Engine --- */
let savedSettings = { scale: 1, highContrast: false }; // Retained framework fallback variables

// THIS MATCHES THE NAME CALLED BY YOUR HTML SLIDER RANGE TRACKER
function clampTextScaleValue(scale) {
    const parsed = parseFloat(scale);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, parsed));
}

function applyTextScaleToDocument(scale, options = {}) {
    const safeScale = clampTextScaleValue(scale);
    const silent = options && options.silent === true;

    document.documentElement.style.setProperty('--text-scale', safeScale);
    document.documentElement.style.fontSize = `${TEXT_SCALE_BASE_PX * safeScale}px`;

    const label = document.getElementById('text-scale-value');
    if (label) label.innerText = `${Math.round(safeScale * 100)}%`;

    if (!silent) hasUnsavedChanges = true;
    return safeScale;
}

function isPortalMobileVisualSettingsLayout() {
    return typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout();
}

function applyPortalMobileVisualSettingsRestrictions() {
    const mobile = isPortalMobileVisualSettingsLayout();

    const uiSlider = document.getElementById('ui-scale-slider');
    const textSlider = document.getElementById('text-scale-slider');
    const hcCheck = document.getElementById('hc-toggle-check');
    const uiGroup = uiSlider?.closest('.settings-group');
    const textGroup = textSlider?.closest('.settings-group');
    const hcGroup = hcCheck?.closest('.settings-group');
    const previewBackdrop = document.getElementById('preview-backdrop-zone');

    const scaleLockTitle = 'Interface scaling is adjusted automatically on mobile.';
    const hcLockTitle = 'High contrast is not used on the mobile portal layout.';

    [uiGroup, textGroup, hcGroup].forEach((groupEl) => {
        if (!groupEl) return;
        groupEl.classList.remove('portal-mobile-setting-locked');
        groupEl.removeAttribute('title');
    });

    if (!mobile) {
        if (uiSlider) uiSlider.disabled = false;
        if (textSlider) textSlider.disabled = false;
        if (hcCheck) hcCheck.disabled = false;
        return;
    }

    if (uiSlider) {
        uiSlider.disabled = true;
        uiSlider.value = confirmedScale;
        const scaleLabel = document.getElementById('scale-value');
        if (scaleLabel) scaleLabel.innerText = `${Math.round(confirmedScale * 100)}%`;
        if (uiGroup) {
            uiGroup.classList.add('portal-mobile-setting-locked');
            uiGroup.setAttribute('title', scaleLockTitle);
        }
    }

    if (textSlider) {
        textSlider.disabled = true;
        textSlider.value = confirmedTextScale;
        applyTextScaleToDocument(confirmedTextScale, { silent: true });
        if (textGroup) {
            textGroup.classList.add('portal-mobile-setting-locked');
            textGroup.setAttribute('title', scaleLockTitle);
        }
    }

    if (hcCheck) {
        hcCheck.disabled = true;
        hcCheck.checked = false;
        if (hcGroup) {
            hcGroup.classList.add('portal-mobile-setting-locked');
            hcGroup.setAttribute('title', hcLockTitle);
        }
    }

    document.body.classList.remove('high-contrast-mode');
    if (previewBackdrop) previewBackdrop.classList.remove('preview-hc-active');
}

function stageTextScale(val) {
    if (isPortalMobileVisualSettingsLayout()) return;
    stagedTextScale = applyTextScaleToDocument(val);
}

function stageUIScale(val) {
    if (isPortalMobileVisualSettingsLayout()) return;
    hasUnsavedChanges = true;
    stagedScale = parseFloat(val); // Capture the slider data silently in memory
    
    // 1. DYNAMICALLY RE-SCALE THE MINI CONTAINER MODEL IN THE SANDBOX SCREEN
    const miniFrame = document.getElementById('preview-modal-frame');
    if (miniFrame) {
        miniFrame.style.transform = `translate(-50%, -50%) scale(${stagedScale})`;
    }

    // 2. LIVE FIELD LABEL STRING UPDATE
    const label = document.getElementById('scale-value');
    if (label) {
        label.innerText = Math.round(stagedScale * 100) + "%";
    }
}

function stageGameChatOpacity(val) {
    hasUnsavedChanges = true;
    stagedGameChatOpacity = Math.max(15, Math.min(100, Number(val) || 85));

    const label = document.getElementById('game-chat-opacity-value');
    if (label) label.textContent = `${stagedGameChatOpacity}%`;

    if (appRuntimeGlobal.RoyalArmiesGameChat && typeof appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity === 'function') {
        appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity(stagedGameChatOpacity, {
            skipPreferenceSync: true,
            skipSettingsUi: true
        });
    }
}

function toggleHighContrast() {
    if (isPortalMobileVisualSettingsLayout()) return;

    hasUnsavedChanges = true;
    
    // THE SAFE SEPARATION FIX: 
    // We target ONLY the miniature sandbox window right now while clicking!
    const previewBackdrop = document.getElementById('preview-backdrop-zone');
    if (previewBackdrop) {
        previewBackdrop.classList.toggle('preview-hc-active');
    }
}

/* --- Block 22: Real-Time Audio Mixer Processing Engine --- */
function stageAudioVolume() { 
    hasUnsavedChanges = true; 
    
    // 1. Fetch values from DOM sliders if they are currently rendered on screen 
    const masterSlider = document.getElementById('master-vol-slider'); 
    const musicSlider = document.getElementById('music-vol-slider'); 
    const narrationSlider = document.getElementById('narration-vol-slider'); 
    const sfxSlider = document.getElementById('sfx-vol-slider'); 
    
    if (masterSlider) stagedMasterVol = parseFloat(masterSlider.value); 
    if (musicSlider) stagedMusicVol = parseFloat(musicSlider.value); 
    if (narrationSlider) stagedNarrationVol = parseFloat(narrationSlider.value); 
    if (sfxSlider) stagedSfxVol = parseFloat(sfxSlider.value); 
    
    // 2. LIVE BACKGROUND MUSIC UPDATE: Adjusts your background looping audio element immediately
    const bgMusicTrack = document.getElementById('ambient-background-audio')
        || document.getElementById('portal-background-theme-audio');
    if (bgMusicTrack) {
        bgMusicTrack.volume = stagedMusicVol * stagedMasterVol;
        if (stagedMusicVol * stagedMasterVol > 0) {
            bgMusicTrack.muted = false;
        }
    }

    localStorage.setItem('savedPortalMasterVol', stagedMasterVol);
    localStorage.setItem('savedPortalMusicVol', stagedMusicVol);
    if (typeof hydratePortalVolumeStateFromStorage === 'function') {
        hydratePortalVolumeStateFromStorage();
    }
    if (typeof applyPortalBackgroundMusicVolume === 'function') {
        applyPortalBackgroundMusicVolume();
    }
    
    // 3. LIVE NARRATION FEEDBACK CALCULATION: Scales narrator files dynamically as you drag 
    if (currentNarration) { 
        let activeBaseVolume = 0.7; 
        
        const detailsHeader = document.querySelector('.lore-pane-right .pane-label'); 
        if (detailsHeader) { 
            const currentActiveName = detailsHeader.innerText.replace(/[►■]/g, '').trim();
            if (currentActiveName === "AESTHENE") activeBaseVolume = 0.4; 
            else if (currentActiveName === "VAELIOR") activeBaseVolume = 0.6; 
        } 
        
        currentNarration.volume = activeBaseVolume * stagedNarrationVol * stagedMasterVol; 
    } 
}

/* --- Block 23: Intelligent Audio Sample Preview Engine --- */
let previewChannels = { music: null, narration: null, sfx: null };
let previewTimers = { music: null, narration: null, sfx: null };

function playLiveAudioPreview(type) {
    // 1. RE-CALCULATE COMPOUND VOLUMES ON THE FLY
    let targetedVolume = 0.5;
    let fileAssetSource = '';
    
    if (type === 'music') {
        targetedVolume = stagedMusicVol * stagedMasterVol;
        fileAssetSource = 'audio/Birth of Argaute.wav'; // Replace with your ambient loop track
    } else if (type === 'narration') {
        targetedVolume = stagedNarrationVol * stagedMasterVol;
        fileAssetSource = 'audio/aesthenehistory.mp3';     // Replace with a standard voice record clip
    } else if (type === 'sfx') {
        targetedVolume = stagedSfxVol * stagedMasterVol;
        fileAssetSource = 'audio/uiselect.wav';         // Reuses your click sound file
    }
    
    // 2. LIVE VOLUME SCALING: If a clip is already playing, update its volume instantly as you drag
    if (previewChannels[type] && !previewChannels[type].paused) {
        previewChannels[type].volume = targetedVolume > 0 ? targetedVolume : 0;
        return; 
    }
    
    // 3. GENERATE AND FIRE AUDIO SAMPLE CHANNELS
    previewChannels[type] = new Audio(fileAssetSource);
    previewChannels[type].volume = targetedVolume > 0 ? targetedVolume : 0;
    
    // Skip to 5 seconds into heavy music loops so players can hear the beat instantly
    if (type === 'music') {
        previewChannels[type].addEventListener('loadedmetadata', () => {
            previewChannels[type].currentTime = 5;
        });
    }
    
    previewChannels[type].play().catch(() => {});
    
    // 4. THE TIME LIMITER GAP SWITCH: Automatically cuts off audio after 1.5 seconds
    if (previewTimers[type]) clearTimeout(previewTimers[type]);
    previewTimers[type] = setTimeout(() => {
        if (previewChannels[type]) {
            previewChannels[type].pause();
            previewChannels[type].currentTime = 0;
        }
    }, 1500); // 1.5 Second short sample audio clip window limit
}

function resolveSaveConfirmationHost() {
    if (typeof getCommanderHubSaveConfirmationHost === 'function') {
        const commanderHost = getCommanderHubSaveConfirmationHost();
        if (commanderHost) {
            return commanderHost;
        }
    }

    const loreModal = document.getElementById('lore-modal');
    if (loreModal) {
        const loreOpen = loreModal.classList.contains('is-visible')
            || loreModal.style.display === 'flex'
            || (loreModal.style.display !== 'none' && loreModal.offsetParent !== null);
        if (loreOpen) {
            return loreModal.querySelector('.lore-content-area') || loreModal;
        }
    }

    return null;
}

function hideSaveChangesConfirmation() {
    document.querySelectorAll('.portal-save-confirmation-toast').forEach((toast) => {
        toast.classList.remove('is-visible');
        toast.hidden = true;
    });
    if (saveConfirmationHideTimer) {
        window.clearTimeout(saveConfirmationHideTimer);
        saveConfirmationHideTimer = null;
    }
}

function showSaveChangesConfirmation(message) {
    const host = resolveSaveConfirmationHost();
    if (!host) return;

    const text = message || 'Your changes have been saved.';
    let toast = host.querySelector(':scope > .portal-save-confirmation-toast')
        || host.querySelector('.portal-save-confirmation-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'portal-save-confirmation-toast';
        toast.setAttribute('aria-live', 'polite');
        host.appendChild(toast);
    }

    if (toast.parentElement !== host) {
        host.appendChild(toast);
    }

    toast.textContent = text;
    toast.hidden = false;
    toast.classList.add('is-visible');

    if (saveConfirmationHideTimer) window.clearTimeout(saveConfirmationHideTimer);
    saveConfirmationHideTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => {
            toast.hidden = true;
        }, 280);
    }, 3400);
}

function captureProfileBioFromEditor() {
    const bioInput = document.getElementById('profile-bio-input');
    if (bioInput) {
        return bioInput.value.trim();
    }
    if (typeof player !== 'undefined' && player.description != null) {
        return String(player.description).trim();
    }
    const cachedBio = readCommanderProfileFromLocalCache().bio;
    return cachedBio.trim();
}

function captureProfilePrivacyFromEditor() {
    const privacyCheck = document.getElementById('privacy-toggle-check');
    if (privacyCheck) {
        return privacyCheck.checked ? 'Public' : 'Private';
    }
    if (typeof player !== 'undefined' && (player.privacy === 'Public' || player.privacy === 'Private')) {
        return player.privacy;
    }
    const cachedPrivacy = readCommanderProfileFromLocalCache().privacy;
    return cachedPrivacy === 'Private' ? 'Private' : 'Public';
}

async function persistProfileFieldsFromEditor() {
    if (typeof player === 'undefined') return { saved: false, synced: null };

    const nextBio = captureProfileBioFromEditor();
    const nextPrivacy = captureProfilePrivacyFromEditor();

    player.description = nextBio;
    player.privacy = nextPrivacy;
    cacheCommanderProfileLocally(nextBio, nextPrivacy);

    if (typeof scheduleCommanderDossierSave === 'function') {
        const synced = await scheduleCommanderDossierSave(
            { bio: nextBio, privacy: nextPrivacy },
            { immediate: true }
        );
        return { saved: true, synced };
    }

    const synced = await saveCommanderProfileToServer(nextBio, nextPrivacy);
    return { saved: true, synced };
}

function isCommanderHubProfileEditorActive() {
    const frame = typeof getActiveCommanderHubFrame === 'function'
        ? getActiveCommanderHubFrame()
        : (document.getElementById('commander-hub-modal') || document.getElementById('portal-commander-hub-page'));
    if (frame?.classList.contains('commander-hub-profile-active')) {
        return true;
    }

    const loreModal = document.getElementById('lore-modal');
    return Boolean(loreModal?.classList.contains('fullscreen-profile-active-state'));
}

function captureProfileEditorBaseline() {
    if (typeof player === 'undefined') return;

    const cached = readCommanderProfileFromLocalCache();
    const savedAvatar = localStorage.getItem('savedProfileAvatarUrl');
    profileEditorBaseline = {
        bio: cached.bio,
        privacy: cached.privacy,
        avatarUrl: savedAvatar && savedAvatar.trim() ? savedAvatar.trim() : player.avatarUrl
    };
}

function bindProfileEditorFooterActions(footerRoot) {
    if (!footerRoot) return;

    const saveBtn = footerRoot.querySelector('.confirm-btn');
    const revertBtn = footerRoot.querySelector('.revert-btn');

    if (saveBtn) {
        saveBtn.type = 'button';
        saveBtn.addEventListener('click', (event) => {
            event.preventDefault();
            saveSettings();
        });
    }

    if (revertBtn) {
        revertBtn.type = 'button';
        revertBtn.addEventListener('click', (event) => {
            event.preventDefault();
            revertSettings();
        });
    }
}

function revertProfileEditorChanges() {
    if (typeof player === 'undefined') return;

    if (!profileEditorBaseline) {
        captureProfileEditorBaseline();
    }

    const baseline = profileEditorBaseline || readCommanderProfileFromLocalCache();
    const avatarUrl = baseline.avatarUrl
        || localStorage.getItem('savedProfileAvatarUrl')
        || player.avatarUrl;

    player.description = baseline.bio ?? '';
    player.privacy = baseline.privacy === 'Private' ? 'Private' : 'Public';
    player.avatarUrl = avatarUrl;

    try {
        localStorage.setItem('savedProfileAvatarUrl', avatarUrl);
    } catch (_err) {
        /* ignore */
    }

    const bioInput = document.getElementById('profile-bio-input');
    if (bioInput) bioInput.value = player.description;

    const privacyCheck = document.getElementById('privacy-toggle-check');
    if (privacyCheck) privacyCheck.checked = player.privacy === 'Public';

    const privacyLabel = document.getElementById('privacy-label-text');
    if (privacyLabel) {
        privacyLabel.innerHTML = `Visibility: <strong>${player.privacy}</strong>`;
    }

    const profileAvatar = document.getElementById('profile-avatar-display');
    if (profileAvatar) profileAvatar.src = avatarUrl;

    document.querySelectorAll('#avatar-preset-selection-bin .avatar-thumb-lever').forEach((thumb) => {
        thumb.classList.toggle('selected-avatar-border', thumb.getAttribute('src') === avatarUrl);
    });

    if (typeof setAvatarArmorySelectorVisible === 'function') {
        setAvatarArmorySelectorVisible(false);
    }

    if (typeof refreshLoggedUserTagDisplay === 'function') {
        refreshLoggedUserTagDisplay();
    } else {
        const navAvatar = document.getElementById('nav-embedded-avatar-crest');
        if (navAvatar) navAvatar.src = avatarUrl;
    }

    hasUnsavedChanges = false;
}

function saveSettings() { 
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    setTimeout(async () => {
        confirmedScale = stagedScale; 
        document.documentElement.style.setProperty('--ui-scale', confirmedScale);

        confirmedTextScale = stagedTextScale;
        applyTextScaleToDocument(confirmedTextScale, { silent: true });
        localStorage.setItem('savedTextScale', confirmedTextScale);
        
        const previewBackdrop = document.getElementById('preview-backdrop-zone'); 
        if (previewBackdrop && previewBackdrop.classList.contains('preview-hc-active')) { 
            document.body.classList.add('high-contrast-mode'); 
        } else { 
            document.body.classList.remove('high-contrast-mode'); 
        } 
        
        const isDyslexiaActive = isDyslexiaFontEnabled();
        
        // 1. LOCK IN AUDIO VOLUMES (UPDATED FOR BACKGROUND MUSIC)
        confirmedMasterVol = stagedMasterVol; 
        confirmedMusicVol = stagedMusicVol; // Locks your music choice
        confirmedNarrationVol = stagedNarrationVol; 
        confirmedSfxVol = stagedSfxVol; 
        confirmedVerbosity = stagedVerbosity; 
        confirmedPings = stagedPings; 
        confirmedSafetyLock = stagedSafetyLock; 
        confirmedGameChatOpacity = stagedGameChatOpacity;

        if (appRuntimeGlobal.RoyalArmiesGameChat && typeof appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity === 'function') {
            appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity(confirmedGameChatOpacity, {
                skipPreferenceSync: true,
                skipSettingsUi: true
            });
        }
        
        // 2. PERSISTENT STORAGE HANDSHAKE (UPDATED FOR BACKGROUND MUSIC)
        localStorage.setItem('savedUIScale', confirmedScale); 
        localStorage.setItem('savedHighContrast', document.body.classList.contains('high-contrast-mode')); 
        localStorage.setItem('savedMasterVol', confirmedMasterVol); 
        localStorage.setItem('savedMusicVol', confirmedMusicVol); // Permanently caches music settings
        localStorage.setItem('savedNarrationVol', confirmedNarrationVol); 
        localStorage.setItem('savedSfxVol', confirmedSfxVol); 
        localStorage.setItem('savedVerbosity', confirmedVerbosity); 
        localStorage.setItem('savedPings', confirmedPings); 
        localStorage.setItem('savedSafetyLock', confirmedSafetyLock); 
        localStorage.setItem('savedDyslexiaFont', isDyslexiaActive);
        localStorage.setItem('savedGameChatOpacity', confirmedGameChatOpacity);

        localStorage.setItem('savedPortalMasterVol', confirmedMasterVol);
        localStorage.setItem('savedPortalMusicVol', confirmedMusicVol);

        const profileResult = await persistProfileFieldsFromEditor();
        const savedProfile = profileResult.saved;
        if (typeof saveFullCommanderDossierToServer === 'function') {
            const dossierSynced = await saveFullCommanderDossierToServer();
            if (savedProfile && profileResult.synced !== false && dossierSynced === false) {
                profileResult.synced = false;
            }
        }
        hasUnsavedChanges = false;

        const hubFrame = typeof getActiveCommanderHubFrame === 'function'
            ? getActiveCommanderHubFrame()
            : (document.getElementById('commander-hub-modal') || document.getElementById('portal-commander-hub-page'));
        if (savedProfile && hubFrame?.classList.contains('commander-hub-profile-active') && typeof reloadProfilePanelView === 'function') {
            reloadProfilePanelView();
        } else if (savedProfile && isCommanderHubProfileEditorActive()) {
            captureProfileEditorBaseline();
        }

        if (typeof applyPortalBackgroundMusicVolume === 'function') {
            applyPortalBackgroundMusicVolume();
        }
        if (typeof hydratePortalVolumeStateFromStorage === 'function') {
            hydratePortalVolumeStateFromStorage();
        }
        if (typeof startPortalBackgroundMusic === 'function') {
            const bgTrack = document.getElementById('portal-background-theme-audio');
            if (bgTrack && bgTrack.paused && (confirmedMusicVol * confirmedMasterVol) > 0) {
                startPortalBackgroundMusic({ markSessionGranted: true, silentFail: true });
            }
        }

        let confirmationText = 'Your changes have been saved.';
        if (savedProfile) {
            if (profileResult.synced === false) {
                confirmationText = 'Settings saved. Your profile bio could not sync to your account — try again shortly.';
            } else {
                confirmationText = 'Profile and settings changes have been saved.';
            }
        }
        showSaveChangesConfirmation(confirmationText);
    }, 10);
} 

/* --- Block 24: Font Accessibility Controller (alias) --- */ 

function revertSettings() { 
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    if (isCommanderHubProfileEditorActive()) {
        setTimeout(() => {
            revertProfileEditorChanges();
        }, 10);
        return;
    }

    setTimeout(() => {
        // 1. INITIALIZE FACTORY BASES (UPDATED FOR BACKGROUND MUSIC)
        confirmedScale = 1; 
        stagedScale = 1;
        confirmedTextScale = 1;
        stagedTextScale = 1;
        applyTextScaleToDocument(1, { silent: true });
        confirmedMasterVol = 1.0; 
        stagedMasterVol = 1.0; 
        confirmedMusicVol = 0.5; // Resets music channel baseline back to 50%
        stagedMusicVol = 0.5;
        confirmedNarrationVol = 1; 
        stagedNarrationVol = 1; 
        confirmedSfxVol = 0.2; 
        stagedSfxVol = 0.2; 
        
        confirmedVerbosity = "Detailed"; stagedVerbosity = "Detailed"; 
        confirmedPings = "Enabled"; stagedPings = "Enabled"; 
        confirmedSafetyLock = "Double-Click"; stagedSafetyLock = "Double-Click"; 
        confirmedGameChatOpacity = 85;
        stagedGameChatOpacity = 85;
        
        document.documentElement.style.setProperty('--ui-scale', 1); 
        localStorage.clear(); 
        
        // 2. RE-SYNC ACTIVE VIEW SLIDERS IF RENDERED ON THE MONITOR (UPDATED FOR BACKGROUND MUSIC)
        const scaleSlider = document.getElementById('ui-scale-slider'); 
        if (scaleSlider) scaleSlider.value = 1;

        const textScaleSlider = document.getElementById('text-scale-slider');
        if (textScaleSlider) textScaleSlider.value = 1;

        const textScaleLabel = document.getElementById('text-scale-value');
        if (textScaleLabel) textScaleLabel.innerText = '100%';
        
        const label = document.getElementById('scale-value'); 
        if (label) label.innerText = "100%"; 
        
        const miniFrame = document.getElementById('preview-modal-frame'); 
        if (miniFrame) miniFrame.style.transform = "translate(-50%, -50%) scale(1)"; 
        
        const masterSlider = document.getElementById('master-vol-slider'); 
        const musicSlider = document.getElementById('music-vol-slider'); // Snaps music handle back to middle
        const narrationSlider = document.getElementById('narration-vol-slider'); 
        const sfxSlider = document.getElementById('sfx-vol-slider'); 
        if (masterSlider) masterSlider.value = 1.0; 
        if (musicSlider) musicSlider.value = 0.5;
        if (narrationSlider) narrationSlider.value = 1; 
        if (sfxSlider) sfxSlider.value = 0.2; 
        
        const vCheck = document.getElementById('verbosity-toggle-check'); 
        if (vCheck) vCheck.checked = true; 
        
        const vText = document.getElementById('verbosity-label-text'); 
        if (vText) vText.innerText = "Detailed"; 
        
        const pCheck = document.getElementById('pings-toggle-check'); 
        if (pCheck) pCheck.checked = true; 
        
        const pText = document.getElementById('pings-label-text'); 
        if (pText) pText.innerText = "Enabled"; 
        
        const lCheck = document.getElementById('lock-toggle-check'); 
        if (lCheck) lCheck.checked = true; 
        
        const lText = document.getElementById('lock-label-text'); 
        if (lText) lText.innerText = "Double"; 

        const chatOpacitySlider = document.getElementById('game-chat-opacity-slider');
        if (chatOpacitySlider) chatOpacitySlider.value = 85;
        const chatOpacityLabel = document.getElementById('game-chat-opacity-value');
        if (chatOpacityLabel) chatOpacityLabel.textContent = '85%';
        if (appRuntimeGlobal.RoyalArmiesGameChat && typeof appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity === 'function') {
            appRuntimeGlobal.RoyalArmiesGameChat.applyPanelOpacity(85, { skipPreferenceSync: true, skipSettingsUi: true });
        }
        
        document.body.classList.remove('high-contrast-mode'); 
        setDyslexiaFontEnabled(false);
        
        const previewBackdrop = document.getElementById('preview-backdrop-zone'); 
        if (previewBackdrop) previewBackdrop.classList.remove('preview-hc-active'); 
        
        hasUnsavedChanges = false; 
    }, 10);
}

/* ==========================================
   RAGE MODULE: GLOBAL BRIDGE & EXPORT BINDINGS
   ========================================== */

/* --- Section: Window-Scoped API Surface --- */ 
window.handleLogin = handleLogin; 
window.confirmSelection = confirmSelection; 
window.selectClass = selectClass;
window.isCommanderEnrolledInActiveAgeRound = isCommanderEnrolledInActiveAgeRound;
window.applyProfileRankResetButtonState = applyProfileRankResetButtonState;
window.applyPortalMobileVisualSettingsRestrictions = applyPortalMobileVisualSettingsRestrictions;
window.beginCommanderAgeResetSession = beginCommanderAgeResetSession;
window.ensureCommanderAgeResetSessionContinuity = ensureCommanderAgeResetSessionContinuity;
window.canUseCommanderReset = canUseCommanderReset;
window.syncPlayerFromActiveCommanderStorage = syncPlayerFromActiveCommanderStorage;
window.refreshProfileCommanderNameDisplay = refreshProfileCommanderNameDisplay;
window.refreshLoggedUserTagDisplay = refreshLoggedUserTagDisplay;
window.refreshMainPortalAuthChrome = refreshMainPortalAuthChrome;
window.openMainPortalGuestRegister = openMainPortalGuestRegister;
window.handleHeaderAuthAction = handleHeaderAuthAction;
window.openMainPortalLoginModal = openMainPortalLoginModal;
window.closeMainPortalLoginModal = closeMainPortalLoginModal;
window.isPortalUserAuthenticated = isPortalUserAuthenticated;
window.persistPortalAuth = persistPortalAuth;
window.clearPortalAuthStorage = clearPortalAuthStorage;
window.ensurePortalAuthRestored = ensurePortalAuthRestored;
window.canUsePortalAuthSessionApi = canUsePortalAuthSessionApi;
window.showSaveChangesConfirmation = showSaveChangesConfirmation;
window.hideSaveChangesConfirmation = hideSaveChangesConfirmation;
window.saveSettings = saveSettings;
window.revertSettings = revertSettings;
window.captureProfileEditorBaseline = captureProfileEditorBaseline;

async function bootstrapMainPortalAuthOnLoad() {
    await ensurePortalAuthRestored();
    syncPlayerFromActiveCommanderStorage();
    if (isPortalUserAuthenticated() && typeof fetchCommanderDossierFromServer === 'function') {
        await fetchCommanderDossierFromServer();
        if (typeof syncCommanderLocaleAfterAuth === 'function') {
            await syncCommanderLocaleAfterAuth();
        }
    } else if (typeof enrichAchievementRecords === 'function' && typeof player !== 'undefined' && Array.isArray(player.awards)) {
        player.awards = enrichAchievementRecords(player.awards);
        try {
            localStorage.setItem('savedCommanderAwards', JSON.stringify(player.awards));
        } catch (_err) {
            /* ignore */
        }
    }
    if (isMainPortalHub()) {
        refreshMainPortalAuthChrome();
        if (typeof applyPortalNavAccessRestrictions === 'function') {
            applyPortalNavAccessRestrictions();
        } else if (typeof applyPortalGuestDeploymentChrome === 'function') {
            applyPortalGuestDeploymentChrome();
        }
        if (typeof syncPortalMobileNavIdentity === 'function') {
            syncPortalMobileNavIdentity();
        }
    }
    if (typeof maybeRunDevAchievementPopupFromQuery === 'function') {
        maybeRunDevAchievementPopupFromQuery();
    } else if (window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery === 'function') {
        window.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery();
    }
    if (isPortalUserAuthenticated() && typeof maybeShowPendingLoginAchievementUnlocks === 'function') {
        setTimeout(() => maybeShowPendingLoginAchievementUnlocks(), 900);
    } else if (isPortalUserAuthenticated() && window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks === 'function') {
        setTimeout(() => window.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks(), 900);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrapMainPortalAuthOnLoad();
        bindPortalNewMessagesBarNavigation();
        consumePendingMailboxNavigation();
    });
} else {
    bootstrapMainPortalAuthOnLoad();
    bindPortalNewMessagesBarNavigation();
    consumePendingMailboxNavigation();
} 

/* --- Block 25: Intercept Security Warning Overlay Engine --- */ 
let warningBypassCallback = null; 

function showAetherWarningModal(onConfirmCallback) { 
    warningBypassCallback = onConfirmCallback; 
    let alertOverlay = document.getElementById('aether-safety-overlay'); 
    if (!alertOverlay) { 
        alertOverlay = document.createElement('div'); 
        alertOverlay.id = 'aether-safety-overlay'; 
        document.body.appendChild(alertOverlay); 
    } 
    alertOverlay.innerHTML = ` 
        <div class="safety-alert-box"> 
            <div class="safety-alert-title">Unsaved changes</div> 
            <div class="safety-alert-message"> 
                You have unsaved settings. If you leave now, your changes will be lost.
            </div> 
            <div class="safety-alert-actions"> 
                <button class="safety-alert-btn discard" onclick="executeWarningBypass()">Discard changes</button> 
                <button class="safety-alert-btn stay" onclick="dismissWarningModal()">Stay here</button> 
            </div> 
        </div> 
    `; 
    alertOverlay.style.display = 'flex'; 
} 

function dismissWarningModal() { 
    const alertOverlay = document.getElementById('aether-safety-overlay'); 
    if (alertOverlay) alertOverlay.style.display = 'none'; 
    warningBypassCallback = null; 
} 

function executeWarningBypass() { 
    const alertOverlay = document.getElementById('aether-safety-overlay'); 
    if (alertOverlay) alertOverlay.style.display = 'none'; 
    if (typeof warningBypassCallback === 'function') { 
        warningBypassCallback(); 
    } 
}

/* --- Block 26: Real-Time Audio Mixer Processing Engine (ADDED) --- */ 
function stageAudioVolume() { 
    hasUnsavedChanges = true; 
    
    const masterSlider = document.getElementById('master-vol-slider'); 
    const musicSlider = document.getElementById('music-vol-slider'); 
    const narrationSlider = document.getElementById('narration-vol-slider'); 
    const sfxSlider = document.getElementById('sfx-vol-slider'); 
    
    if (masterSlider) stagedMasterVol = parseFloat(masterSlider.value); 
    if (musicSlider) stagedMusicVol = parseFloat(musicSlider.value); 
    if (narrationSlider) stagedNarrationVol = parseFloat(narrationSlider.value); 
    if (sfxSlider) stagedSfxVol = parseFloat(sfxSlider.value); 
    
    // THE HTML BRIDGING HOOK: Tracks and controls your native main-theme element!
    const musicElement = document.getElementById('main-theme');
    if (musicElement) {
        let calculatedMusicVolume = stagedMusicVol * stagedMasterVol;
        musicElement.volume = calculatedMusicVolume > 0 ? calculatedMusicVolume : 0;
    }
    
    // LIVE NARRATION FEEDBACK CALCULATION
    if (currentNarration) { 
        let activeBaseVolume = 0.7; 
        const detailsHeader = document.querySelector('.lore-pane-right .pane-label'); 
        
        if (detailsHeader) { 
            const currentActiveName = detailsHeader.innerText.replace(/[►■]/g, '').trim();
            if (currentActiveName === "AESTHENE") activeBaseVolume = 0.4; 
            else if (currentActiveName === "VAELIOR") activeBaseVolume = 0.6; 
        } 
        
        currentNarration.volume = activeBaseVolume * stagedNarrationVol * stagedMasterVol; 
    } 
}

/* --- Block 27: Gameplay & Strategy Toggle Controllers (CLEANED) --- */ 
function toggleVerbosity() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    hasUnsavedChanges = true;
    const checkbox = document.getElementById('verbosity-toggle-check');
    stagedVerbosity = (checkbox && checkbox.checked) ? "Detailed" : "Summary Only";
    const textLabel = document.getElementById('verbosity-label-text');
    if (textLabel) textLabel.innerText = stagedVerbosity;
}

function toggleAttackPings() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    hasUnsavedChanges = true;
    const checkbox = document.getElementById('pings-toggle-check');
    stagedPings = (checkbox && checkbox.checked) ? "Enabled" : "Disabled";
    const textLabel = document.getElementById('pings-label-text');
    if (textLabel) textLabel.innerText = stagedPings;
}

function toggleSafetyLock() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    hasUnsavedChanges = true;
    const checkbox = document.getElementById('lock-toggle-check');
    stagedSafetyLock = (checkbox && checkbox.checked) ? "Double-Click" : "Single-Click";
    const textLabel = document.getElementById('lock-label-text');
    if (textLabel) textLabel.innerText = (stagedSafetyLock === "Double-Click") ? "Double" : "Single";
}

/* --- Block 28: Profile Visibility & Penalty Dock Toggle Switch --- */
function toggleProfilePrivacy() {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    hasUnsavedChanges = true;
    
    const checkbox = document.getElementById('privacy-toggle-check');
    const textLabel = document.getElementById('privacy-label-text');
    
    // 1. Establish state variables based on input checkbox position cleanly
    player.privacy = (checkbox && checkbox.checked) ? "Public" : "Private";
    
    // 2. Update the dynamic visibility readout indicator text inside your view box pane
    if (textLabel) {
        textLabel.innerHTML = `Visibility: <strong>${player.privacy}</strong>`;
    }
} 

/* --- Block 29: Archon Multi-Stage Sequential Account Warning Engine --- */

// 1. THE DIALOG DATA SEQUENCING MATRICES
const suicideDialogSequences = {
    rank: [
        {
            text: "You have chosen to disband your post and relinquish your rank. Would you like to continue?",
            buttons: [{ text: "YES", action: "next" }, { text: "CANCEL", action: "close" }]
        },
        {
            text: "Are you certain? You may still remain in the same country you are currently in but you will be returned to the lowest rank and will have to rebuild everything you worked so hard to achieve.",
            buttons: [{ text: "YES", action: "next" }, { text: "CANCEL", action: "close" }]
        },
        {
            text: "You know, the grind is the most agitating, yet rewarding part of a game. You bail now and you will have to live through that again. Especially since the age is probably already half way concluded.",
            buttons: [{ text: "I Don't Care", action: "next" }, { text: "STAY", action: "close" }]
        },
        {
            text: "You're really doing this, huh? Honestly, I thought you were better than this. crippling your countries strength because you couldn't fight on through until the end. You should be ashamed of yourself.",
            buttons: [{ text: "Secede Rank", action: "commit" }, { text: "RETREAT", action: "close" }]
        },
        {
            text: "Deserter.",
            buttons: [{ text: "Close", action: "finalize" }]
        }
    ],
    exile: [
        {
            text: "What?! Why would you do that! It's one thing to give up your rank and return to a first rank official but it's a whole other seriously messed up issue to suicide!",
            buttons: [{ text: "Suicide", action: "next" }, { text: "CANCEL", action: "close" }]
        },
        {
            text: "Are you certain everything is okay? Are you having problems at home? Do you want to talk about it? Don't go down this route. It leads nowhere good.",
            buttons: [{ text: "Suicide", action: "next" }, { text: "ABORT", action: "close" }]
        },
        {
            text: "You really want to do this? Think about your loved ones! The ones who raised you, your friends, your siblings, your significant other maybe. Times may be hard right now but getting through the hardships is what brings forth great reward in the end. That I can assure you.",
            buttons: [{ text: "Suicide", action: "next" }, { text: "RETHINK", action: "close" }]
        },
        {
            text: "Well, I guess I can't stop you then. You have to choose for yourself whether you want to disappear from this world and crush the hearts of everyone who cares about you or choose to stay and fight against these suicidal thoughts. Just one thing before you make a final decision. Jesus is watching. Do you really want to deal with the aftermath of having to face him and tell him why you didn't try and fight? I'd rethink that if I were you.",
            buttons: [{ text: "Suicide", action: "next" }, { text: "STAND AND FIGHT", action: "close" }]
        },
        {
            text: "Seriously! You're still going through with this? Fine, whatever. Do what you want. I don't care anymore. Just remember, you brought this on yourself. Good luck in whatever awaits you after death. Jerk...",
            buttons: [{ text: "Suicide", action: "next" }, { text: "STAY", action: "close" }]
        },
        {
            text: "...",
            buttons: [{ text: "What?", action: "next" }, { text: "CLOSE", action: "close" }]
        },
                {
            text: "What do I have to do to get you to stop? Do I have to beg you? Do I have to cry? Do I have to get down on my knees and plead with you not to do this? Is that what it will take for you to see how much of a mistake this is?",
            buttons: [{ text: "No", action: "next" }, { text: "RETURN", action: "close" }]
        },
        {
            text: "Fine. If you're really going to suicide out then so be it but if you really insist on it then I'm going to suicide right along with you. That's right. Your attitude makes me want to disappear as well. What do you say about that, huh? Can you still do it knowing that someone else is going to follow suit? That's what happens. It's like a domino effect. Your choices influence the choices of others and right now you doing this makes me want to do it too. So, have at it! We go together! On my mark. 1...2...3...",
            buttons: [{ text: "Suicide", action: "next" }, { text: "FORGET IT", action: "close" }]
        },
        {
            text: "I've decided I don't want to do it. I've got so much to live for. I mean, who's going to keep bringing in more great content for this game if I give up now? We all have a future and whether or not that future is one that I can be proud of all depends on me. Just me. So I'm taking that chance and pressing on.",
            buttons: [{ text: "Suicide", action: "next" }, { text: "I BELIEVE!", action: "close" }]
        },
        {
            text: "Last chance...",
            buttons: [{ text: "Suicide out of Country", action: "commit" }, { text: "OKAY, FINE", action: "close" }]
        },
        {
            text: "Your account has been removed from the active country and your player record was cleared.",
            buttons: [{ text: "Close and Return to Join Age Screen", action: "finalize" }]
        }
    ]
};

// Global index state pointers to track where the player is inside the warning arrays
let currentSuicideMode = null;
let currentSuicideStep = 0;

/* --- Section: Commander Profile Multi-Stage Warning Engine --- */

/* Block 30: Commander Profile Multi-Stage Warning Engine */

function triggerCommanderSuicide(mode) {
    if ((mode === 'rank' || mode === 'exile') && !canUseCommanderReset(mode)) {
        applyProfileRankResetButtonState();
        return;
    }

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    // 1. Map the active branch identifier safely into memory
    currentSuicideMode = mode;
    currentSuicideStep = 0;
    
    const overlay = document.getElementById('commander-suicide-overlay');
    if (overlay) {
        overlay.classList.remove('mailbox-reading-overlay');
        // 2. Clear the inline display constraints to unlock visual rendering passes
        overlay.style.setProperty('display', 'flex', 'important');
        
        // 3. Strip the background hiding class handles cleanly
        overlay.classList.remove('suicide-overlay-hidden');
        
        renderSuicideDialogStep();
    }
}

function renderSuicideDialogStep() {
    const textField = document.getElementById('suicide-popup-text-field');
    const btnDock = document.getElementById('suicide-popup-btn-dock');
    
    if (!textField || !btnDock || !currentSuicideMode) return;
    
    // THE SAFE EXTRACTOR: Locks onto the active text block sequence matching your choice keys
    const activeSequence = suicideDialogSequences[currentSuicideMode];
    if (!activeSequence || !activeSequence[currentSuicideStep]) {
        closeSuicideOverlayWindow();
        return;
    }
    
    const activeStepData = activeSequence[currentSuicideStep];
    
    // Update the warning paragraph text content
    textField.innerText = activeStepData.text;
    btnDock.innerHTML = "";
    
    // Dynamically spawn operational response buttons
    activeStepData.buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.innerText = btnInfo.text;
        
        // Balance visual styles based on action hazard tiers
        if (btnInfo.action === 'next' || btnInfo.action === 'commit') {
            button.className = 'suicide-danger-confirm-btn';
        } else {
            button.className = 'suicide-safe-retreat-btn';
        }
        
        // THE FIXED INTERCEPT LINK: Direct property handler captures click data cleanly
        button.onclick = (e) => {
            if (e) e.stopPropagation();
            if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
            handleSuicideActionSelection(btnInfo.action);
        };
        
        btnDock.appendChild(button);
    });
}

function handleSuicideActionSelection(action) {
    if (action === 'close') {
        // Safe retreat: Close the window modal immediately and abort account deletion loops
        closeSuicideOverlayWindow();
    } else if (action === 'next') {
        // Advance dialog pipeline tree stage index
        currentSuicideStep++;
        renderSuicideDialogStep();
    } else if (action === 'commit') {
        if ((currentSuicideMode === 'rank' || currentSuicideMode === 'exile') && !canUseCommanderReset(currentSuicideMode)) {
            closeSuicideOverlayWindow();
            applyProfileRankResetButtonState();
            return;
        }

        if (currentSuicideMode === 'rank' || currentSuicideMode === 'exile') {
            incrementCommanderResetUsage(currentSuicideMode);
        }

        // ACCOUNT DEFAULT STRUCTURAL DISK WIPING SIMULATION
        if (currentSuicideMode === 'rank') {
            player.rank = 1;
            player.xp = 0;
            player.gold = 1000; // Reset gold currency metrics back to default baseline configurations
            console.log("Commander rank defaults written.");
        } else if (currentSuicideMode === 'exile') {
            player.rank = 1;
            player.xp = 0;
            player.gold = 1000;
            player.country = "Unassigned Void";
            console.log("Commander exile default states written.");
        }
        
        // Push step index pointer to the final confirmation panel text box block row
        currentSuicideStep++;
        renderSuicideDialogStep();
        applyProfileRankResetButtonState();
    } else if (action === 'finalize') {
        // Clear variables, commit changes to disk memory cache records, re-render, and clear the screen
        hasUnsavedChanges = false;
        localStorage.removeItem('savedCommanderInActiveAge');
        if (currentSuicideMode === 'exile') {
            clearCommanderAgeResetSession();
        }
        if (typeof notifyPortalAgeSessionLeave === 'function') notifyPortalAgeSessionLeave();
        if (typeof saveSettings === 'function') saveSettings();
        reloadProfilePanelView();
        applyProfileRankResetButtonState();

        closeSuicideOverlayWindow();
    }
}

function closeSuicideOverlayWindow() {
    const overlay = document.getElementById('commander-suicide-overlay');
    if (overlay) {
        overlay.classList.remove('mailbox-reading-overlay');
        // 1. Forcefully lock down direct hardware display properties back to silent zero
        overlay.style.setProperty('display', 'none', 'important');
        
        // 2. Re-apply the global style blueprint backup mask classes
        overlay.classList.add('suicide-overlay-hidden');
    }
    currentSuicideMode = null;
    currentSuicideStep = 0;
}

/* --- Block 31: Unified Avatar Customization Controllers --- */
function setAvatarArmorySelectorVisible(isVisible) {
    const selectorBin = document.getElementById('avatar-preset-selection-bin');
    if (!selectorBin) return;
    selectorBin.hidden = !isVisible;
    selectorBin.style.display = isVisible ? 'block' : 'none';
}

function openAvatarArmorySelector(e) {
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    setAvatarArmorySelectorVisible(true);

    const selectorBin = document.getElementById('avatar-preset-selection-bin');
    if (
        selectorBin
        && typeof isPortalMobileNavLayout === 'function'
        && isPortalMobileNavLayout()
    ) {
        window.requestAnimationFrame(() => {
            selectorBin.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }
}

function closeAvatarArmorySelector(e) {
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    setAvatarArmorySelectorVisible(false);
}

function selectPresetAvatar(chosenUrl) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    hasUnsavedChanges = true;
    player.avatarUrl = chosenUrl;
    
    // Live update the layout display badge inside your top banner panel instantly 
    const mainImgDisplay = document.getElementById('profile-avatar-display');
    if (mainImgDisplay) mainImgDisplay.src = chosenUrl;
    
    // 💾 CACHE SYNCHRONIZATION SHARD SYSTEM:
    // Saves the selected image path onto your device disk cache layout tracks!
    // This allows your isolated script2.js file to read and load your custom choice natively.
    localStorage.setItem("savedProfileAvatarUrl", chosenUrl);
    if (typeof scheduleCommanderDossierSave === 'function') {
        scheduleCommanderDossierSave({ avatarUrl: chosenUrl });
    }
    
    closeAvatarArmorySelector();
}

/* --- MESSAGE COMPOSE: REPLY / FORWARD CONTEXT --- */
const SYSTEM_MESSAGE_FROM_LABEL = 'Ledger System';
const SYSTEM_MESSAGE_HEADER_LABEL = 'System Message';
const COMMANDER_DISPATCH_HEADER_LABEL = 'Message';

function formatMailboxFromLabel(msg, track) {
    if (track === 'system') return SYSTEM_MESSAGE_FROM_LABEL;
    return msg?.from || 'Unsent Draft Record';
}

function formatMailboxOverlayHeaderLabel(track) {
    if (track === 'system') return SYSTEM_MESSAGE_HEADER_LABEL;
    return COMMANDER_DISPATCH_HEADER_LABEL;
}
function escapeMessageHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatMailboxReadingBody(msg, track) {
    const body = msg?.body || '';
    if (track === 'system' && msg?.bodyFormat === 'html') {
        return body;
    }
    return `"${escapeMessageHtml(body)}"`;
}

function normalizeReplyTopic(topic) {
    const trimmed = (topic || '').trim();
    if (/^re:\s/i.test(trimmed)) return trimmed;
    return `RE: ${trimmed}`;
}

function normalizeForwardTopic(topic) {
    const trimmed = (topic || '').trim();
    if (/^fwd:\s/i.test(trimmed)) return trimmed;
    return `FWD: ${trimmed}`;
}

function buildForwardedBodyBlock(msg) {
    const lines = [
        '',
        '---------- Forwarded dispatch ----------',
        `From: ${msg.from || 'Unknown'}`,
        `Topic: ${msg.topic || ''}`
    ];
    if (msg.date) lines.push(`Date: ${msg.date}`);
    lines.push('', msg.body || '', '------------------------------------------', '');
    return lines.join('\n');
}

function resetMessageComposeFields() {
    activeWartimeRecipients = [];
    const dock = document.getElementById('msg-recipient-pill-dock');
    if (dock) {
        dock.innerHTML = '<span class="pill-placeholder-txt">Select Recipients</span>';
    }
    const subject = document.getElementById('msg-subject-input-element');
    const body = document.getElementById('msg-body-input-element');
    if (subject) subject.value = '';
    if (body) body.value = '';
    hideRecipientDirectoryDrawer();
}

function clearMessageComposeContext() {
    messageComposeMode = null;
    messageComposeSource = null;
    applyMessageComposeFieldLocks();
    renderMessageComposeContextBanner();
}

function applyMessageComposeFieldLocks() {
    const isReply = messageComposeMode === 'reply';
    const subject = document.getElementById('msg-subject-input-element');
    const addBtn = document.getElementById('msg-recipient-add-btn')
        || document.querySelector('.msg-recipient-add-btn');
    const sendRow = document.querySelector('.msg-send-to-row');
    const topicRow = document.querySelector('.msg-topic-row');

    if (subject) {
        subject.readOnly = isReply;
        subject.classList.toggle('msg-compose-field-locked', isReply);
    }
    if (addBtn) {
        addBtn.disabled = isReply;
        addBtn.style.display = isReply ? 'none' : '';
    }
    if (sendRow) sendRow.classList.toggle('msg-compose-field-locked', isReply);
    if (topicRow) topicRow.classList.toggle('msg-compose-field-locked', isReply);

    document.querySelectorAll('.recipient-pill-capsule strong').forEach((removeBtn) => {
        removeBtn.style.display = isReply ? 'none' : '';
    });
}

function renderMessageComposeContextBanner() {
    const banner = document.getElementById('msg-compose-context-banner');
    if (!banner) return;

    if (!messageComposeSource || !messageComposeMode) {
        banner.classList.add('msg-compose-context-hidden');
        banner.innerHTML = '';
        banner.setAttribute('aria-hidden', 'true');
        return;
    }

    const msg = messageComposeSource;
    const modeLabel = messageComposeMode === 'reply' ? 'Original message' : 'Forwarding message';
    banner.classList.remove('msg-compose-context-hidden');
    banner.setAttribute('aria-hidden', 'false');
    banner.innerHTML = `
        <div class="msg-compose-context-label">${modeLabel}</div>
        <div class="msg-compose-context-meta">
            <strong>From:</strong> ${escapeMessageHtml(msg.from || 'Unknown')}
            &nbsp;|&nbsp; <strong>Topic:</strong> ${escapeMessageHtml(msg.topic || '')}
            ${msg.date ? `&nbsp;|&nbsp; <strong>Date:</strong> ${escapeMessageHtml(msg.date)}` : ''}
        </div>
        <div class="msg-compose-context-body">"${escapeMessageHtml(msg.body || '')}"</div>
    `;
}

function focusMessagesSendSubnav(callback) {
    const subnavRoot = document.getElementById('commander-hub-subnav')
        || document.getElementById('lore-titles-container');
    if (!subnavRoot) {
        if (callback) callback();
        return;
    }
    const items = subnavRoot.querySelectorAll('.commander-hub-subnav-item, .update-item');
    if (items[0]) items[0].click();
    window.setTimeout(callback, 50);
}

function openMessageComposeFromDossier(msg, mode) {
    if (!msg) return;
    closeSuicideOverlayWindow();
    messageComposeApplyingFromDossier = true;
    messageComposeMode = mode;
    messageComposeSource = msg;

    focusMessagesSendSubnav(() => {
        resetMessageComposeFields();

        if (mode === 'reply') {
            setLockedReplyRecipient(msg.from);
            const subject = document.getElementById('msg-subject-input-element');
            if (subject) subject.value = normalizeReplyTopic(msg.topic);
            const body = document.getElementById('msg-body-input-element');
            if (body) body.focus();
        } else if (mode === 'forward') {
            const subject = document.getElementById('msg-subject-input-element');
            const body = document.getElementById('msg-body-input-element');
            if (subject) subject.value = normalizeForwardTopic(msg.topic);
            if (body) body.value = buildForwardedBodyBlock(msg);
        }

        applyMessageComposeFieldLocks();
        renderMessageComposeContextBanner();
        messageComposeApplyingFromDossier = false;
    });
}

/* --- INTERACTIVE MULTI-RECIPIENT RADAR PATH CONTROLLERS --- */
function isPortalMobileMessageComposeLayout() {
    return typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout();
}

function syncRecipientDirectoryMobilePresentation(isOpen) {
    const slot = document.getElementById('msg-recipient-directory-slot');
    if (!slot) return;

    if (!isPortalMobileMessageComposeLayout()) {
        slot.classList.add('msg-recipient-directory-slot--collapsed');
        slot.classList.remove('msg-recipient-directory-slot--open');
        slot.setAttribute('aria-hidden', 'true');
        return;
    }

    slot.classList.toggle('msg-recipient-directory-slot--open', isOpen);
    slot.classList.toggle('msg-recipient-directory-slot--collapsed', !isOpen);
    slot.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

function toggleRecipientDirectory(e) {
    if (messageComposeMode === 'reply') return;
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const drawer = document.getElementById('msg-directory-floating-drawer');
    if (!drawer) return;
    
    if (drawer.classList.contains('msg-floating-drawer-hidden')) {
        const openDrawer = () => {
            drawer.classList.remove('msg-floating-drawer-hidden');
            syncRecipientDirectoryMobilePresentation(true);
            drillDownDirectory('root');
            resetRecipientDrawerScrollPosition();
            document.addEventListener('click', closeRecipientDrawerOutsideDismissalLatch);
        };

        if (isMailboxRecipientRosterAdmin()) {
            loadMailboxAdminRecipientRoster().then(() => openDrawer());
        } else {
            openDrawer();
        }
    } else {
        hideRecipientDirectoryDrawer();
    }
}

function hideRecipientDirectoryDrawer() {
    const drawer = document.getElementById('msg-directory-floating-drawer');
    if (drawer) drawer.classList.add('msg-floating-drawer-hidden');
    syncRecipientDirectoryMobilePresentation(false);
    document.removeEventListener('click', closeRecipientDrawerOutsideDismissalLatch);
}

function closeRecipientDrawerOutsideDismissalLatch(e) {
    const drawer = document.getElementById('msg-directory-floating-drawer');
    const addBtn = document.querySelector('.msg-recipient-add-btn');
    const slot = document.getElementById('msg-recipient-directory-slot');
    const clickedInsideDrawer = drawer && drawer.contains(e.target);
    const clickedAddBtn = e.target === addBtn || (addBtn && addBtn.contains(e.target));

    if (!clickedInsideDrawer && !clickedAddBtn) {
        hideRecipientDirectoryDrawer();
    }
}

function resetRecipientDrawerScrollPosition() {
    const mainPane = document.getElementById('drawer-main-category-view');
    const drillPane = document.getElementById('drawer-drilldown-category-view');
    if (mainPane) mainPane.scrollTop = 0;
    if (drillPane) drillPane.scrollTop = 0;
}

function appendRecipientDrawerEmptyNote(drillPane, message) {
    drillPane.innerHTML += `<div class="drawer-node-row drawer-node-empty">${message}</div>`;
}

function getActiveCommanderDisplayName() {
    if (typeof player !== 'undefined' && player.name) return String(player.name).trim();
    return String(localStorage.getItem('activeCommanderUser') || '').trim();
}

function drillDownDirectory(tier, payload) {
    const mainPane = document.getElementById('drawer-main-category-view');
    const drillPane = document.getElementById('drawer-drilldown-category-view');
    if (!mainPane || !drillPane) return;

    if (tier === 'root') {
        renderRecipientDrawerRootCategories();
        mainPane.classList.remove('msg-drawer-pane-hidden');
        drillPane.classList.add('msg-drawer-pane-hidden');
        resetRecipientDrawerScrollPosition();
        return;
    }

    // Collapse category root view to open drilldown canvas area layout
    mainPane.classList.add('msg-drawer-pane-hidden');
    drillPane.classList.remove('msg-drawer-pane-hidden');
    drillPane.innerHTML = `<div class="drawer-back-node-row" onclick="drillDownDirectory('root')">◀ Back to Radar Tracks</div>`;

    const selfName = getActiveCommanderDisplayName();

    /* --- PARSE TIER A: NATIVE SOVEREIGN COUNTRY REALM --- */
    if (tier === 'country') {
        const data = globalFactionServerDirectory.country;
        const roster = (data.players || []).filter((p) => p && p !== selfName);
        if (!roster.length) {
            appendRecipientDrawerEmptyNote(drillPane, 'No commanders in your country roster yet.');
        } else {
            roster.forEach((p) => {
                const safe = escapeRecipientDrawerJsLiteral(p);
                drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${safe}')">👤 ${p}</div>`;
            });
        }
    }
    /* --- PARSE TIER B: NATIVE INTERNATIONAL COUNTRY ALLIES SYSTEM --- */
    else if (tier === 'allies') {
        if (!payload) {
            const allies = globalFactionServerDirectory.allies || [];
            if (!allies.length) {
                appendRecipientDrawerEmptyNote(drillPane, 'No allied nation rosters available yet.');
            } else {
                allies.forEach((allyNation, index) => {
                    drillPane.innerHTML += `<div class="drawer-node-row" onclick="drillDownDirectory('ally-nation', ${index})">🤝 ${allyNation.name} Sector <span>►</span></div>`;
                });
            }
        }
    }
    else if (tier === 'ally-nation') {
        const allyNation = globalFactionServerDirectory.allies[payload];
        if (!allyNation) return;
        drillPane.innerHTML = `<div class="drawer-back-node-row" onclick="drillDownDirectory('allies')">◀ Back to Allies list</div>`;
        const roster = (allyNation.players || []).filter((p) => p && p !== selfName);
        if (!roster.length) {
            appendRecipientDrawerEmptyNote(drillPane, `No commanders listed for ${allyNation.name} yet.`);
        } else {
            roster.forEach((p) => {
                const safe = escapeRecipientDrawerJsLiteral(p);
                drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${safe}')">👤 ${p}</div>`;
            });
        }
    }
    /* --- PARSE TIER C: SPAM PROTECTED LONE OPERATIONS TRACKS --- */
    else if (tier === 'other') {
        const roster = (globalFactionServerDirectory.other || []).filter((p) => p && p !== selfName);
        if (!roster.length) {
            appendRecipientDrawerEmptyNote(drillPane, 'No other commanders available to message yet.');
        } else {
            roster.forEach((p) => {
                const safe = escapeRecipientDrawerJsLiteral(p);
                drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${safe}')">👤 ${p}</div>`;
            });
        }
    }
    /* --- PARSE TIER D: OWNER LEDGER ROSTER (caleb_admin only) --- */
    else if (tier === 'registered-all' || tier === 'registered-verified' || tier === 'registered-unverified') {
        const categoryKey = tier === 'registered-all'
            ? 'all'
            : (tier === 'registered-verified' ? 'verified' : 'unverified');
        const titles = {
            all: 'All Registered Commanders',
            verified: 'Verified Commanders',
            unverified: 'Pending Verification'
        };

        if (!isMailboxRecipientRosterAdmin() || !mailboxAdminRecipientCategories) {
            appendRecipientDrawerEmptyNote(drillPane, 'Recipient roster unavailable.');
        } else {
            const roster = getMailboxAdminRecipientRosterForCategory(categoryKey)
                .filter((p) => p && p !== selfName);
            if (!roster.length) {
                appendRecipientDrawerEmptyNote(drillPane, `No commanders in ${titles[categoryKey]} yet.`);
            } else {
                roster.forEach((p) => {
                    const safe = escapeRecipientDrawerJsLiteral(p);
                    drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${safe}')">👤 ${p}</div>`;
                });
            }
        }
    }

    resetRecipientDrawerScrollPosition();
}

function setLockedReplyRecipient(targetName) {
    const name = String(targetName || '').trim();
    if (!name) return false;

    activeWartimeRecipients = [name];
    const dock = document.getElementById('msg-recipient-pill-dock');
    if (!dock) return false;

    dock.innerHTML = '';
    const pill = document.createElement('div');
    pill.className = 'recipient-pill-capsule recipient-pill-capsule--reply-locked';
    pill.id = `pill-node-${name.replace(/\s+/g, '-')}`;
    pill.innerHTML = `<span>${escapeMessageHtml(name)}</span>`;
    dock.appendChild(pill);
    return true;
}

function appendRecipientPill(targetName) {
    if (messageComposeMode === 'reply' && !messageComposeApplyingFromDossier) return;
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    // Prevent duplicate entries into target capsule lines
    if (activeWartimeRecipients.includes(targetName)) return;

    // Clear placeholder text if it's the very first selection pass
    if (activeWartimeRecipients.length === 0) {
        document.getElementById('msg-recipient-pill-dock').innerHTML = "";
    }

    activeWartimeRecipients.push(targetName);

    const pill = document.createElement('div');
    pill.className = 'recipient-pill-capsule';
    pill.id = `pill-node-${targetName.replace(/\s+/g, '-')}`;
    pill.innerHTML = `
        <span>${targetName}</span>
        <strong onclick="removeRecipientPill('${targetName}', event)">×</strong>
    `;
    document.getElementById('msg-recipient-pill-dock').appendChild(pill);
}

function removeRecipientPill(targetName, e) {
    if (messageComposeMode === 'reply') return;
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    activeWartimeRecipients = activeWartimeRecipients.filter(r => r !== targetName);
    const pill = document.getElementById(`pill-node-${targetName.replace(/\s+/g, '-')}`);
    if (pill) pill.remove();

    if (activeWartimeRecipients.length === 0) {
        document.getElementById('msg-recipient-pill-dock').innerHTML = `<span class="pill-placeholder-txt">Select recipients...</span>`;
    }
}

/* --- DISPATCH EXECUTION WORKER FLOWS --- */
async function executeOutgoingMessageDispatch() {
    const topic = document.getElementById('msg-subject-input-element').value.trim();
    const bodyText = document.getElementById('msg-body-input-element').value.trim();

    if (activeWartimeRecipients.length === 0 || !topic || !bodyText) {
        await showPortalAlert('Choose at least one recipient and fill in both subject and message.');
        return;
    }

    const sender = getMailboxApiUsername();
    if (!sender) {
        await showPortalAlert('Log in with a registered commander on the game server (port 3000) to send messages.');
        return;
    }

    if (!isMailboxApiAvailable()) {
        await showPortalAlert(
            'Messages require the Royal Armies API. Run node server.js (port 3000), then use Live Server or http://localhost:3000.',
            'Server required'
        );
        return;
    }

    try {
        const response = await fetch('/api/portal/mailbox/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender,
                recipients: [...activeWartimeRecipients],
                topic,
                body: bodyText
            })
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'ok') {
            await showPortalAlert(payload.message || 'Could not send message. Check recipients and try again.', 'Message not sent');
            return;
        }

        await showPortalAlert(`Message sent to: ${(payload.recipients || activeWartimeRecipients).join(', ')}`, 'Message sent');
        await fetchCommanderMailboxFromServer();
        clearMessageComposeContext();
        resetMessageComposeFields();
        window.pendingMessagesHubChannel = 'messages';
        window.pendingMessagesFolder = 'sent';
        reloadMessagesPanelView();
    } catch (err) {
        await showPortalAlert('Could not reach the message server. Is node server.js running?', 'Connection error');
    }
}

async function commitMessageToDraftCache() {
    const topic = document.getElementById('msg-subject-input-element').value.trim() || "Untitled Draft";
    const bodyText = document.getElementById('msg-body-input-element').value.trim() || "";

    if (!getMailboxApiUsername()) {
        await showPortalAlert('Log in with a registered commander to save drafts.');
        return;
    }

    if (!isMailboxApiAvailable()) {
        await showPortalAlert(
            'Drafts require the Royal Armies API. Run node server.js (port 3000), then use Live Server or http://localhost:3000.',
            'Server required'
        );
        return;
    }

    const saved = await saveMailboxDraftOnServer([...activeWartimeRecipients], topic, bodyText);
    if (!saved) {
        await showPortalAlert('Could not save draft.');
        return;
    }

    await fetchCommanderMailboxFromServer();
    await showPortalAlert('Draft saved.', 'Draft saved');
    window.pendingMessagesHubChannel = 'messages';
    window.pendingMessagesFolder = 'drafts';
    reloadMessagesPanelView();
}

function renderDossierPortalListHTML(targetTrack) {
    let dataSet = [];
    if (targetTrack === 'inbox') dataSet = playerInboundInboxDossier;
    else if (targetTrack === 'system') dataSet = playerSystemInboxDossier;
    else if (targetTrack === 'drafts') dataSet = playerDraftsInboxDossier;
    else if (targetTrack === 'sent') dataSet = playerSentInboxDossier;

    const prefix = targetTrack === 'system' ? 'sys' : (targetTrack === 'sent' ? 'sent' : 'msg');
    const dockId = targetTrack === 'drafts'
        ? 'msg-drafts-render-dock'
        : (targetTrack === 'sent'
            ? 'msg-sent-render-dock'
            : (targetTrack === 'system' ? 'msg-system-render-dock' : 'msg-inbox-render-dock'));
    const listBin = document.getElementById(dockId);
    if (!listBin) return;
    listBin.innerHTML = '';
    
    // TARGET HARDWIRED CONSOLE TOOLBARS
    const toggleBtn = document.getElementById(`${prefix}-multi-delete-toggle`);
    const selectAllBtn = document.getElementById(`${prefix}-select-all-btn`);
    const confirmPurgeBtn = document.getElementById(`${prefix}-confirm-delete-btn`);
    
    if (toggleBtn) {
        // 🔥 THE AUTOMATED QUANTITY CONDITIONAL PASS:
        // If the active folder dataset has 0 or 1 total messages, completely delete the buttons!
        if (dataSet.length <= 1) {
            toggleBtn.style.setProperty('display', 'none', 'important');
            if (selectAllBtn) selectAllBtn.style.setProperty('display', 'none', 'important');
            if (confirmPurgeBtn) confirmPurgeBtn.style.setProperty('display', 'none', 'important');
        } else {
            // Restore visibility rules cleanly if multiple logs are present
            toggleBtn.style.setProperty('display', 'inline-block', 'important');
        }
    }

    if (dataSet.length === 0) {
        listBin.innerHTML = `<div class="empty-roster-txt" style="padding:20px !important;">No messages in this folder yet.</div>`;
        return;
    }
    
    dataSet.forEach(msg => {
        const row = document.createElement('div');
        row.className = `msg-dossier-summary-row ${msg.read ? 'msg-dossier-read' : 'msg-dossier-unread'}`;
        row.onclick = () => openFocusedDossierReadingOverlay(msg, targetTrack);
        
        let metaSender = 'System';
        if (targetTrack === 'system') {
            metaSender = SYSTEM_MESSAGE_FROM_LABEL;
        } else if (targetTrack === 'sent') {
            const sentTo = Array.isArray(msg.recipients) && msg.recipients.length
                ? msg.recipients.join(', ')
                : (msg.to || '');
            metaSender = sentTo ? `To: ${sentTo}` : 'To: (unknown)';
        } else if (msg.from) {
            metaSender = msg.from;
        } else if (Array.isArray(msg.recipients) && msg.recipients.length) {
            metaSender = `To: ${msg.recipients.join(', ')}`;
        }
        let checkboxMarkup = isMassDeletionActive[targetTrack]
            ? `<input type="checkbox" class="msg-purge-checkbox-lever" data-id="${msg.id}" onclick="event.stopPropagation()">`
            : "";
            
        row.innerHTML = `
            <div class="msg-summary-left-block">
                <span class="msg-badge-indicator">${msg.read ? '📖' : '✉️'}</span>
                <span class="msg-sender-name-label">${metaSender}</span>
                <span class="msg-topic-header-preview">${msg.topic}</span>
            </div>
            <div class="msg-summary-right-block">
                <span class="msg-timestamp-label">${msg.date || 'Draft'}</span>
                ${checkboxMarkup}
            </div>
        `;
        listBin.appendChild(row);
    });

    if (targetTrack === 'inbox' || targetTrack === 'system') syncNavMailboxIndicators();
}

/* --- HIGH FANTASY POPUP DISPATCH READING WINDOW --- */
function openFocusedDossierReadingOverlay(msg, track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    msg.read = true;
    renderDossierPortalListHTML(track);
    persistMailboxAndSyncNav();
    if (track === 'inbox' || track === 'system') {
        patchMailboxMessageReadOnServer(msg.id);
    }
    if (track === 'sent') {
        msg.read = true;
    }

    // Reuse your absolute body center overlay layer blueprints for reading popups
    const overlay = document.getElementById('commander-suicide-overlay');
    const textField = document.getElementById('suicide-popup-text-field');
    const btnDock = document.getElementById('suicide-popup-btn-dock');

    if (!overlay || !textField || !btnDock) return;

    const overlayHeader = document.getElementById('suicide-popup-header-title');
    if (overlayHeader) {
        overlayHeader.textContent = formatMailboxOverlayHeaderLabel(track);
    }

    // Inject letter text layout formats inside your golden bezel
    const sentToLine = track === 'sent'
        ? (Array.isArray(msg.recipients) && msg.recipients.length ? msg.recipients.join(', ') : (msg.to || ''))
        : '';
    const headerFromLine = track === 'sent'
        ? `<strong>TO:</strong> ${sentToLine || 'Unknown'}<br>`
        : `<strong>FROM:</strong> ${formatMailboxFromLabel(msg, track)}<br>`;

    textField.innerHTML = `
        <div style="text-align:left !important; font-family:'Segoe UI',sans-serif; color:#f1e0ac; font-size:0.8rem; border-bottom:1px solid rgba(184,144,48,0.2); padding-bottom:8px; margin-bottom:12px;">
            ${headerFromLine}
            <strong>TOPIC:</strong> ${msg.topic}
        </div>
        <div class="msg-reading-body-scroll portal-gold-scrollbar">
            ${formatMailboxReadingBody(msg, track)}
        </div>
    `;

    btnDock.innerHTML = "";

    if (track === 'inbox') {
        const replyBtn = document.createElement('button');
        replyBtn.className = 'suicide-safe-retreat-btn';
        replyBtn.innerText = 'Reply';
        replyBtn.onclick = () => openMessageComposeFromDossier(msg, 'reply');
        btnDock.appendChild(replyBtn);

        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'suicide-safe-retreat-btn';
        forwardBtn.innerText = 'Forward';
        forwardBtn.onclick = () => openMessageComposeFromDossier(msg, 'forward');
        btnDock.appendChild(forwardBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'suicide-danger-confirm-btn';
    deleteBtn.innerText = "Delete";
    deleteBtn.onclick = async () => {
        if (track === 'inbox') {
            await deleteMailboxMessageOnServer(msg.id, 'inbox');
            playerInboundInboxDossier = playerInboundInboxDossier.filter((m) => m.id !== msg.id);
        } else if (track === 'system') {
            await deleteMailboxMessageOnServer(msg.id, 'system');
            playerSystemInboxDossier = playerSystemInboxDossier.filter((m) => m.id !== msg.id);
        } else if (track === 'sent') {
            await deleteMailboxMessageOnServer(msg.id, 'sent');
            playerSentInboxDossier = playerSentInboxDossier.filter((m) => m.id !== msg.id);
        } else if (track === 'drafts') {
            await deleteMailboxDraftOnServer(msg.id);
            playerDraftsInboxDossier = playerDraftsInboxDossier.filter((m) => m.id !== msg.id);
        }

        closeSuicideOverlayWindow();
        await fetchCommanderMailboxFromServer();
        renderDossierPortalListHTML(track);
        persistMailboxAndSyncNav();
    };

    const returnBtn = document.createElement('button');
    returnBtn.className = 'suicide-safe-retreat-btn';
    returnBtn.innerText = 'Close';
    returnBtn.onclick = () => closeSuicideOverlayWindow();

    btnDock.appendChild(deleteBtn);
    btnDock.appendChild(returnBtn);

    overlay.classList.add('mailbox-reading-overlay');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.classList.remove('suicide-overlay-hidden');
}

/* --- MASS DELETION CHECKBOX DRIVER SYSTEMS --- */
function toggleMassDeletionMode(track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    isMassDeletionActive[track] = !isMassDeletionActive[track];
    renderDossierPortalListHTML(track);

    // Toggle toolbars visibility configurations inside your document grid
    const prefix = track === 'system' ? 'sys' : (track === 'sent' ? 'sent' : 'msg');
    const selectAllBtn = document.getElementById(`${prefix}-select-all-btn`);
    const confirmPurgeBtn = document.getElementById(`${prefix}-confirm-delete-btn`);
    const toggleBtn = document.getElementById(`${prefix}-multi-delete-toggle`);

    if (isMassDeletionActive[track]) {
        if (selectAllBtn) selectAllBtn.classList.remove('msg-drawer-pane-hidden');
        if (confirmPurgeBtn) confirmPurgeBtn.classList.remove('msg-drawer-pane-hidden');
        if (toggleBtn) toggleBtn.innerText = "Cancel Mode";
    } else {
        if (selectAllBtn) selectAllBtn.classList.add('msg-drawer-pane-hidden');
        if (confirmPurgeBtn) confirmPurgeBtn.classList.add('msg-drawer-pane-hidden');
        if (toggleBtn) toggleBtn.innerText = "Delete Multiple";
    }
}

function executeSelectAllMessageCheckboxes(track) {
    const dockId = track === 'sent'
        ? 'msg-sent-render-dock'
        : (track === 'system' ? 'msg-system-render-dock' : 'msg-inbox-render-dock');
    const checkboxes = document.querySelectorAll(`#${dockId} .msg-purge-checkbox-lever`);
    checkboxes.forEach((box) => { box.checked = true; });
}

async function executeMassDossierPurge(track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const dockId = track === 'sent'
        ? 'msg-sent-render-dock'
        : (track === 'system' ? 'msg-system-render-dock' : 'msg-inbox-render-dock');
    const checkboxes = document.querySelectorAll(`#${dockId} .msg-purge-checkbox-lever:checked`);
    if (checkboxes.length === 0) return;

    const idsToPurge = Array.from(checkboxes).map((box) => Number(box.getAttribute('data-id'))).filter((id) => Number.isFinite(id));

    if (track === 'inbox' || track === 'system' || track === 'sent') {
        await purgeMailboxMessagesOnServer(track, idsToPurge);
    }

    if (track === 'inbox') playerInboundInboxDossier = playerInboundInboxDossier.filter((m) => !idsToPurge.includes(m.id));
    else if (track === 'system') playerSystemInboxDossier = playerSystemInboxDossier.filter((m) => !idsToPurge.includes(m.id));
    else if (track === 'sent') playerSentInboxDossier = playerSentInboxDossier.filter((m) => !idsToPurge.includes(m.id));

    isMassDeletionActive[track] = false;
    toggleMassDeletionMode(track);
    await fetchCommanderMailboxFromServer();
    renderDossierPortalListHTML(track);
    persistMailboxAndSyncNav();
    await showPortalAlert(`Purged ${idsToPurge.length} message(s) from your ${track} folder.`, 'Messages purged');
}

window.syncNavMailboxIndicators = syncNavMailboxIndicators;
window.openMailboxFromNewMessagesBar = openMailboxFromNewMessagesBar;
window.bindPortalNewMessagesBarNavigation = bindPortalNewMessagesBarNavigation;
window.receiveCommanderInboxMessage = receiveCommanderInboxMessage;
window.fetchCommanderMailboxFromServer = fetchCommanderMailboxFromServer;
window.startPortalMailboxPolling = startPortalMailboxPolling;
window.stopPortalMailboxPolling = stopPortalMailboxPolling;
window.pollCommanderMailboxFromServer = pollCommanderMailboxFromServer;
window.activateMessagesFolder = activateMessagesFolder;
window.loadCommanderMailboxDossiersFromStorage = loadCommanderMailboxDossiersFromStorage;
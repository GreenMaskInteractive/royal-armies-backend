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
let saveConfirmationHideTimer = null;

// Master Audio System Channels 
let confirmedMasterVol = parseFloat(localStorage.getItem('savedMasterVol')) || 1.0; 
let confirmedMusicVol = parseFloat(localStorage.getItem('savedMusicVol')) || 0.5; // NEW: Stored background music value register 
let confirmedNarrationVol = parseFloat(localStorage.getItem('savedNarrationVol')) || 0.7; 
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

// RUN INSTANTLY ON BOOT: Sync visual styles and dimensions immediately before rendering page loops 
document.documentElement.style.setProperty('--ui-scale', confirmedScale);
applyTextScaleToDocument(confirmedTextScale, { silent: true });
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
        detailsBody = document.getElementById('commander-hub-body') || document.getElementById('lore-details-body');
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

// Global address book containing player lists broken into country categories
const allianceAddressBook = {
    country: ["Vaelior_Guard", "Archon_Prime", "Aesthene_Scout"],
    allies: {
        "Vaelior": ["Guard_Captain", "Elder_Scribe"],
        "Aesthene": ["Mage_Vanguard", "Pyromancer_X"]
    },
    other: ["Grief_King_99", "Rogue_Trader", "Void_Wanderer"]
};

/* --- Section: Player Profile & Penalty Catalog --- */

function getActiveCommanderUsername() {
    const saved = localStorage.getItem('activeCommanderUser');
    if (saved && saved.trim() !== '') return saved.trim();
    return 'testaccount';
}

function hydratePlayerPublicDossierFromStorage() {
    if (typeof player === 'undefined') return;
    const savedBio = localStorage.getItem('savedCommanderBio');
    if (savedBio !== null) player.description = savedBio;
    const savedPrivacy = localStorage.getItem('savedCommanderPrivacy');
    if (savedPrivacy === 'Public' || savedPrivacy === 'Private') player.privacy = savedPrivacy;
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
    if (!Array.isArray(player.ageHistory)) player.ageHistory = [];
    if (!Array.isArray(player.awards)) player.awards = [];
}

function syncPlayerFromActiveCommanderStorage() {
    if (typeof player === 'undefined') return;
    player.name = getActiveCommanderUsername();
    const savedAvatar = localStorage.getItem('savedProfileAvatarUrl');
    if (savedAvatar) player.avatarUrl = savedAvatar;
    hydratePlayerPublicDossierFromStorage();
    refreshProfileCommanderNameDisplay();
    refreshLoggedUserTagDisplay();
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
    if (tag) tag.innerText = getActiveCommanderUsername();
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
    
    membershipTitle: "Bronze", 
    description: "Honorable Commander of the Royal Front. Seeking tactical alliances.", 
    privacy: "Public", 
    
    // Social Node Arrays 
    friends: ["Vaelior_Guard", "Aesthene_Scout"], 
    blocked: ["Grief_King_99"],

    // Public dossier: ages served 24+ hours (newest first, max 5 shown on profile card)
    ageHistory: [],
    // Public dossier: { id, iconUrl?, label, achievement } — iconUrl optional until assets exist
    awards: [],
    
    // Discipline Monitoring System (UPDATED EXTENSION COUPLING)
    // Seamlessly feeds exact properties into your live account verification popup loop!
    penalties: [
        { 
            type: "Chat Restrict", 
            expires: "2026-06-01", 
            severity: "Minor",
            icon: "images/penalties/mark_mute.png",
            desc: "Obtained by: Violation of chat safety parameters or spamming. Blocks outgoing text signals."
        },
        { 
            type: "Grief Mark", 
            expires: "2026-07-15", 
            severity: "Moderate",
            icon: "images/penalties/mark_grief.png",
            desc: "Obtained by: Intentional friendly fire or resource sabotage against allied deployment sectors."
        }
    ]
};

const globalPenaltyCatalog = {
    chat: {
        name: "Communication Restriction",
        icon: "images/penalties/mark_mute.png",
        desc: "Obtained by: Violation of chat safety parameters or spamming. Blocks outgoing text signals."
    },
    grief: {
        name: "Tactical Subversion (Griefing)",
        icon: "images/penalties/mark_grief.png",
        desc: "Obtained by: Intentional friendly fire or resource sabotage against allied deployment sectors."
    },
    exploit: {
        name: "Aether Bug Exploitation",
        icon: "images/penalties/mark_exploit.png",
        desc: "Obtained by: Abusing database loop vulnerabilities or running unverified external macro scripts."
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

function manageSecurityUpdate(mode) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const overlay = document.getElementById('commander-security-overlay');
    const headerTitle = document.getElementById('security-popup-header-title');
    const textField = document.getElementById('security-popup-text-field');
    const btnDock = document.getElementById('security-popup-btn-dock');
    
    if (!overlay || !headerTitle || !textField || !btnDock) return;
    
    // Reset any old interior element loops inside our container
    textField.innerHTML = "";
    btnDock.innerHTML = "";
    
    if (mode === 'email') {
        headerTitle.innerText = "UPDATE SECURE COMMUNICATION CHANNELS";
        textField.innerHTML = `
            <div style="margin-bottom: 12px; color: rgba(241,224,172,0.6); font-size: 0.75rem;">Current Address: <span style="color: #ffd700;">${player.name}@royalfront.net</span></div>
            <input type="email" id="security-email-input-field" placeholder="Enter new tactical email matrix..." 
                   style="width: 100% !important; background: rgba(0,0,0,0.6) !important; border: 1px solid rgba(184,144,48,0.4) !important; padding: 8px !important; color: #f1e0ac !important; font-family: 'Segoe UI', sans-serif !important; font-size: 0.8rem !important; box-sizing: border-box !important; outline: none !important;">
        `;
    } else if (mode === 'password') {
        headerTitle.innerText = "RE-CALIBRATE AETHER ENCRYPTION CYPHERS";
        textField.innerHTML = `
            <input type="password" id="security-pass-old-field" placeholder="Verify old encryption password phrase..." 
                   style="width: 100% !important; background: rgba(0,0,0,0.6) !important; border: 1px solid rgba(184,144,48,0.4) !important; padding: 8px !important; color: #f1e0ac !important; font-family: 'Segoe UI', sans-serif !important; font-size: 0.8rem !important; margin-bottom: 10px !important; box-sizing: border-box !important; outline: none !important;">
            <input type="password" id="security-pass-new-field" placeholder="Forge new secure verification key..." 
                   style="width: 100% !important; background: rgba(0,0,0,0.6) !important; border: 1px solid rgba(184,144,48,0.4) !important; padding: 8px !important; color: #f1e0ac !important; font-family: 'Segoe UI', sans-serif !important; font-size: 0.8rem !important; box-sizing: border-box !important; outline: none !important;">
        `;
    }
    
    // Forge Action Buttons
    const saveBtn = document.createElement('button');
    saveBtn.className = 'suicide-danger-confirm-btn'; // Gold gradient color themes
    saveBtn.innerText = "SEAL SECURE KEYS";
    saveBtn.style.borderColor = "#b89030";
    saveBtn.onclick = () => {
        if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
        // Fire database preservation link traces
        hasUnsavedChanges = true;
        closeSecurityOverlayWindow();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'suicide-safe-retreat-btn';
    cancelBtn.innerText = "ABORT UPDATE";
    cancelBtn.onclick = () => {
        if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
        closeSecurityOverlayWindow();
    };
    
    btnDock.appendChild(saveBtn);
    btnDock.appendChild(cancelBtn);
    
    // Reveal the global layout layers smoothly
    overlay.classList.remove('suicide-overlay-hidden');
    overlay.style.setProperty('display', 'flex', 'important');
}

function closeSecurityOverlayWindow() {
    const overlay = document.getElementById('commander-security-overlay');
    if (overlay) {
        overlay.style.setProperty('display', 'none', 'important');
        overlay.classList.add('suicide-overlay-hidden');
    }
}



/* ==========================================
   RAGE MODULE: INITIALIZATION & EVENT LISTENERS
   ========================================== */

/* --- Section: Boot Sequence & Audio Handshake --- */

// Live Storage arrays for testing runtime mutations without servers
var activeWartimeRecipients = []; 
var isMassDeletionActive = { inbox: false, system: false };
var messageComposeMode = null;
var messageComposeSource = null;
var messageComposeApplyingFromDossier = false;

// MOCK GLOBAL SERVER PLAYER AND REALM DIRECTORY ROSTER MATRIX
const globalFactionServerDirectory = {
    country: {
        name: "United Kingdom",
        council: ["Archon_Regent", "High_Paladin"],
        players: ["Archon_Regent", "High_Paladin", "testaccount", "Sovereign_Shield", "Garrick_Iron"]
    },
    allies: [
        {
            name: "Aesthene",
            council: ["Frost_Seer_Vael"],
            players: ["Frost_Seer_Vael", "Aesthene_Scout", "Ymir_Vanguard", "Kaelen_Guard"]
        },
        {
            name: "Vaelior",
            council: ["High_Warden_Celeste"],
            players: ["High_Warden_Celeste", "Vaelior_Guard", "Silversmith_Elena"]
        }
    ],
    other: ["Rogue_Shadow_99", "Mercenary_X", "Lonesome_Knight", "Exiled_Scribe"]
};

// SIMULATION ENVELOPE DATABASES
var playerInboundInboxDossier = [
    { id: 101, from: "Archon_Regent", topic: "DEFENSE OF SECTOR 7", body: "We require immediate heavy reinforcements at the western stone lines. The sand empires are moving catapult positions.", read: false, date: "2026-05-17 10:14" },
    { id: 102, from: "High_Paladin", topic: "Gold Reserves Allocation", body: "The crown has distributed 1,000 gold currency parameters to your secure profile wallet for sector provisions.", read: true, date: "2026-05-16 18:42" }
];

var playerSystemInboxDossier = [
    { id: 501, from: "DEVELOPMENT TEAM", topic: "Patch Update Matrix 1.04", body: "The Fullscreen profile customization dashboards and administrative discipline overlays are now completely operational. Secure encryption ciphers verified.", read: false, date: "2026-05-17 08:00" },
    { id: 502, from: "DEVELOPMENT TEAM", topic: "Daily Safety reminder Loop", body: "Maintain immersive fair play interactions within sector grids. 3 strike penalties result in IP automated blockades.", read: true, date: "2026-05-15 12:00" }
];

var playerDraftsInboxDossier = [
    { id: 901, recipients: ["Frost_Seer_Vael"], topic: "Drafted Peace Treaty Request", body: "Proposed alliance structures across northern mountain passes..." }
];

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
    if (!music) return;

    if (!music.muted) {
        music.muted = true;
        isMuted = true;
        if (icon) icon.className = 'icon-muted';
        console.log("Ambiance Silenced.");
    } else {
        music.muted = false;
        isMuted = false;
        music.play();
        // If overdrive was active, resume the context
        if (audioContext) audioContext.resume();
        if (icon) icon.className = 'icon-unmuted';
        console.log("Symphony Resumed.");
    }
}

/* ==========================================
   RAGE MODULE: AUTHENTICATION & LOGIN FLOW
   ========================================== */

/* --- Section: Chronicle Data & Login Engine --- */

/* --- Block 2: The Chronicle Archives (Full Data Set) --- */
const CHRONICLE_DATA = {
    genesis: { title: "The Genesis Forge", details: "Established the core Aether-Rage framework. This includes the obsidian and gold visual theme, the dynamic background slideshow engine, and the initial server handshakes." },
    audio: { title: "Symphony of War", details: "Integrated the spatial audio engine featuring 'Stone and Water.' Developed the custom sticky audio controls and the smooth cross-fade mute logic." },
    narrative: { title: "The Traveler's Guidance", details: "Built the Narrative System and the mysterious 'Retired Old Man' portrait interaction. Engineered the typing text effect for immersive lore delivery." },
    interface: { title: "Navigator & Roadmap", details: "Deployed the Widescreen Roadmap system (95vw) and developed the 'Hub Docking' logic to ensure panels align perfectly with navigator icons." },
    security: { title: "Nexus Gatekeeping", details: "Established the Secure Login Engine. Developed the Developer Override (Skeleton Key) bypass system for rapid internal testing and legend-tier access." },
    assets: { title: "GIMP Asset Integration", details: "A massive refinement phase. Merged logos and stone frames into high-performance single-load assets in GIMP to eliminate scaling lag and flickering." },
    optimization: { title: "Engine Optimization", details: "Refined frame-timings and background transition smooth-scaling. Implemented the 'Absolute-Zero' centering fix for the Commander's Portal." },
    networking: { title: "Nexus Socket Sync", details: "Developed the real-time synchronization between the client and the Nexus server to handle player state and global event notifications." },
    roadmap_foundation: { title: "Phase 1: The Foundation", details: "Core architecture build-out. Focusing on Nexus login systems, high-resolution GIMP asset pipelines, and the cinematic landing portal currently active." },
    roadmap_combat: { title: "Phase 2: Aether Combat Sync", details: "Implementing real-time hit detection and spell-casting animations. Synchronizing state between players within the Hall of Statues environment." },
    roadmap_classes: { title: "Phase 3: Class Specialization", details: "Finalizing the Battlemaster and Archmage skill trees. Adding unique crest animations and specific ability loadouts for both legendary paths." },
    roadmap_world: { title: "Phase 4: The Outer Realms", details: "Expanding the walkable map beyond the initial statues. Adding environmental audio triggers and multi-zone narrative checkpoints." },
    roadmap_economy: { title: "Phase 5: Royal Trade & Economy", details: "Integrating gold-flow systems, vendor interactions, and the personal inventory vault for items acquired in the Outer Realms." },
    roadmap_launch: { title: "Phase 6: Royal Ascension", details: "The final transition to a live environment. Includes community discord events, global player database deployment, and the grand opening of the gates." },
    networking_nexus: { title: "Nexus Handshake", details: "Established the server-side communication link for the registration engine. Automated the 'Gatekeeper' email confirmation system for new Commanders." 
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
    if (register) register.style.display = 'none';
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
        alert('Please provide credentials to the Gatekeepers.');
        restoreLoginAuthButtons();
        return;
    }

    if (isAdmin) {
        localStorage.setItem('activeCommanderUser', userVal);
        if (typeof player !== 'undefined') player.name = userVal;
        refreshProfileCommanderNameDisplay();
        refreshLoggedUserTagDisplay();
        initiatePostLoginSequence(true);
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert(payload.message || 'The Gatekeepers rejected those credentials.');
            restoreLoginAuthButtons();
            return;
        }

        const ledgerUsername = payload.username || userVal;
        localStorage.setItem('activeCommanderUser', ledgerUsername);
        if (typeof player !== 'undefined') player.name = ledgerUsername;
        refreshProfileCommanderNameDisplay();
        refreshLoggedUserTagDisplay();
        initiatePostLoginSequence(false);
    } catch (err) {
        console.error('NEXUS login link error:', err);
        alert('Cannot reach the Royal Armies server. Run node server.js locally (or use the live site) and try again.');
        restoreLoginAuthButtons();
    }
}

/* --- Block 5: Post-Login Transition --- */
function initiatePostLoginSequence(isAdmin) {
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');
    
    if(loginWrapper) loginWrapper.style.opacity = '0';
    if(authButtons) authButtons.style.opacity = '0';
    
    setTimeout(() => {
        if (!isAdmin) {
            console.log("Standard Profile Cleared. Forwarding Domain Auth Token...");
            
            sessionStorage.setItem("royalArmiesAuthAudioPlay", "granted");
            
            const secureRedirectAnchor = document.createElement('a');
            secureRedirectAnchor.href = 'ageportal.html';
            secureRedirectAnchor.style.display = 'none';
            document.body.appendChild(secureRedirectAnchor);
            
            secureRedirectAnchor.click();
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
    if (typeof playLoginMusic === "function") { playLoginMusic(); }
    const landing = document.getElementById('page-landing');
    const statues = document.getElementById('class-selection-screen');
    if(landing) landing.style.display = 'none';
    if(statues) statues.style.display = 'flex';
}

function openDiscord() {
    // ⚔️ NEXUS: Access granted to all Commanders immediately
    window.open('https://discord.gg/7tGBCt7cXX', '_blank');
}

function handleRegister() {
    closeAllActiveUI();
    const modal = document.getElementById('register-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    }
}

function closeRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

function handleForgot(e) {
    if (e) e.preventDefault();
    try {
        if (typeof closeAllActiveUI === "function") closeAllActiveUI();
    } catch (err) {
        console.warn("NEXUS: UI Cleanup bypassed.");
    }
    const modal = document.getElementById('forgot-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    }
}

function closeForgot() {
    const modal = document.getElementById('forgot-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

/* --- THE SUBMISSION PROTOCOL (NEXUS Handshake Enabled) --- */

function submitRegistration() {
    const user = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!user || !email || !pass || !confirm) {
        alert("The Gatekeepers require all fields to be filled, Commander.");
        return;
    }
    if (pass !== confirm) {
        alert("Your passwords do not match. Re-verify your credentials.");
        return;
    }

    fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.trim(), email: email.trim(), password: pass })
    })
    .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
            alert(payload.message || 'Registration saved. Check your email for the confirmation scroll.');
            closeRegister();
            return;
        }
        alert(payload.message || 'Registration could not be completed.');
    })
    .catch((err) => {
        console.error('Nexus Link Error:', err);
        alert('Cannot reach the Royal Armies server. Make sure node server.js is running, then try again.');
    });
} // <--- Added this to close submitRegistration properly

function submitForgot(e) {
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput ? emailInput.value : '';
    const btn = e ? e.target : event.target;

    if (!email || !email.includes('@')) {
        alert("The Royal Guard requires a valid email address.");
        return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Sending...";

    fetch('/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
    })
    .then(response => {
        if (!response.ok) throw new Error("Server Rejected Connection");
        return response.json();
    })
    .then(data => {
        alert("A one-time password link will be sent to the e-mail provided if it is in our records.");
        closeForgot();
    })
    .catch(err => {
        console.error("Nexus Link Error:", err);
        alert("Transmission Failed: The Nexus Server is unresponsive.");
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = originalText;
    });
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
        // Automatically loads the 15 nations on open
        loadLore('archives');
        initLoreScrollSpy();
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

/* --- Block 15: Category Scroll-Spy (Final Grouping) --- */ 
function initLoreScrollSpy() { 
    const container = document.getElementById('lore-titles-container'); 
    const header = document.querySelector('.lore-pane-left .pane-label'); 
    
    if (!container || !header) return; 

    container.addEventListener('scroll', () => { 
        const buttons = container.querySelectorAll('.update-item'); 
        let activeCategory = "NATIONS"; 

        buttons.forEach(btn => { 
            const rect = btn.getBoundingClientRect(); 
            const parentRect = container.getBoundingClientRect(); 

            // Detect if the button is within the top 50px of the scroll window
            if (rect.top >= parentRect.top && rect.top <= parentRect.top + 50) { 
                const name = btn.innerText; 

                // MAPPED TO YOUR SPECIFIC DIVISIONS
                if (["Vaelior", "Aesthene", "Khaerant", "Aethelgard"].includes(name)) { 
                    activeCategory = "Gilded Sovereignties"; 
                } else if (["Krall", "Gorz", "Thruun", "Skaros"].includes(name)) { 
                    activeCategory = "Primal Hordes"; 
                } else if (["Lyllis", "Saelthine", "Vaerenth"].includes(name)) { 
                    activeCategory = "Ethereal Covenants"; 
                } else if (["Trex", "Mynor", "Zevros", "Dravic"].includes(name)) { 
                    activeCategory = "Iron Vanguards"; 
                } 
            } 
        }); 

        if (header.innerText !== activeCategory) { 
            header.innerText = activeCategory; 
        } 
    }); 
}

/* ==========================================
   RAGE MODULE: LORE CONTENT ENGINE
   ========================================== */

/* --- Section: The Great Library --- */

/* Block 16: Nation Lore Repository */
const nationLore = {
    archives: [
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
    ],
    manuscripts: [
        { name: "The First Era", detail: "The lost writings detailing the arrival of the Aidoriian bloodline." }
    ],
    letters: [
        { name: "Letter to Aethelgard", detail: "A frantic warning sent during the Great Transition." }
    ],
    
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
                        <label class="msg-field-label">SEND TO</label>
                        <div class="send-to-pill-container" id="msg-recipient-pill-dock">
                            <span class="pill-placeholder-txt">Select Recipients</span>
                        </div>
                        <button type="button" class="msg-recipient-add-btn" id="msg-recipient-add-btn" onclick="toggleRecipientDirectory(event)">➕</button>
                        
                        <!-- THE DYNAMIC FLOATING TARGET DIRECTORY DRAWER (FIXED INITIAL HIDDEN HANDLE) -->
                        <div id="msg-directory-floating-drawer" class="msg-floating-drawer-hidden" onclick="event.stopPropagation()">
                            <div class="drawer-header-title">📜 RECIPIENTS LOG</div>
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
                        <label class="msg-field-label">TOPIC</label>
                        <input type="text" id="msg-subject-input-element" placeholder="" maxlength="60">
                    </div>
                    <!-- RAW PLAIN PARCHMENT SCROLL TEXT AREA -->
                    <div class="message-input-row-block flex-grow-area">
                        <label class="msg-field-label"></label>
                        <textarea id="msg-body-input-element" placeholder=""></textarea>
                    </div>
                    <!-- TRANSACTION DISPATCH CONTROLS DECK -->
                    <div class="message-action-deck-row">
                        <button class="settings-btn" onclick="executeOutgoingMessageDispatch()">Seal & Send Message</button>
                        <button class="settings-btn" style="border-color: rgba(184,144,48,0.3) !important;" onclick="commitMessageToDraftCache()">Save As Draft</button>
                    </div>
                </div>
            `
        },
        {
            name: "Messages",
            detail: `
                <div class="message-workspace-canvas">
                    <div class="msg-portal-toolbar">
                        <!-- FIXED TARGET EXTENSION ID MATCHED DIRECTLY TO RENDERER -->
                        <button class="settings-btn mini-btn" id="msg-multi-delete-toggle" onclick="toggleMassDeletionMode('inbox')">Delete Multiple</button>
                        <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="msg-select-all-btn" onclick="executeSelectAllMessageCheckboxes('inbox')">Select All</button>
                        <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="msg-confirm-delete-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="executeMassDossierPurge('inbox')">Purge Selected</button>
                    </div>
                    <div class="msg-portal-scroll-bin" id="msg-inbox-render-dock"></div>
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
                        <button class="settings-btn mini-btn msg-drawer-pane-hidden" id="sys-confirm-delete-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="executeMassDossierPurge('system')">Purge Selected</button>
                    </div>
                    <div class="msg-portal-scroll-bin" id="msg-system-render-dock"></div>
                </div>
            `
        },
        {
            name: "Drafts",
            detail: `
                <div class="message-workspace-canvas">
                    <div class="msg-portal-scroll-bin" id="msg-drafts-render-dock"></div>
                </div>
            `
        }
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
                            <div class="preview-sandbox-label">Aether Interface Live Preview</div>
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
                            <input type="range" min="0" max="1" step="0.05" value="0.7" class="settings-slider" id="narration-vol-slider" oninput="stageAudioVolume(); playLiveAudioPreview('narration')">
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
                            <label class="settings-label">Tactical Action Safety Lock</label>
                            <div class="settings-right-wrapper">
                                <span class="toggle-label-text" id="lock-label-text">Double</span>
                                <label class="switch-toggle-bar">
                                    <input type="checkbox" id="lock-toggle-check" onclick="toggleSafetyLock()">
                                    <div class="toggle-slider-track"></div>
                                </label>
                            </div>
                        </div>
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
                                        <textarea id="profile-bio-input" maxlength="250" placeholder="Chronicle your achievements, Commander..." oninput="hasUnsavedChanges=true; player.description=this.value;">\${player.description}</textarea>
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
                                    <button class="settings-btn" onclick="manageSecurityUpdate('password')">Change Encryption Password</button>
                                </div>
                            </div>
                            
                            <div class="profile-section-box footer-box-third">
                                <label class="settings-label">System Enforcement Simulator</label>
                                <div class="profile-btn-row-stacked">
                                    <button class="settings-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="checkSystemLoginPenalties()">Simulate Account Verification Login</button>
                                </div>
                            </div>
                            
                            <div class="profile-section-box footer-box-third critical-danger-zone">
                                <label class="settings-label warning-title">Rank Reset</label>
                                <div class="profile-btn-row-stacked">
                                    <button class="danger-action-btn" onclick="triggerCommanderSuicide('rank')">Sacrifice Commander Rank</button>
                                    <button class="danger-action-btn" onclick="triggerCommanderSuicide('exile')">Suicide Out of Active Country</button>
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
}

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
    return document.getElementById('commander-hub-body')
        || document.getElementById('lore-details-body');
}

function reloadProfilePanelView() {
    if (document.getElementById('commander-hub-modal')?.classList.contains('is-visible')) {
        if (typeof loadCommanderHubSection === 'function') loadCommanderHubSection('profile');
        return;
    }
    if (typeof loadLore === 'function') loadLore('profile');
}

function reloadMessagesPanelView() {
    if (document.getElementById('commander-hub-modal')?.classList.contains('is-visible')) {
        if (typeof loadCommanderHubSection === 'function') loadCommanderHubSection('messages');
        return;
    }
    if (typeof loadLore === 'function') loadLore('messages');
}

function isCommanderEnrolledInActiveAgeRound() {
    return localStorage.getItem('savedCommanderInActiveAge') === 'true';
}

function markHubChannelTabActive(activeBtn, container) {
    if (!container) return;
    container.querySelectorAll('.commander-hub-subnav-item, .update-item').forEach((tab) => {
        tab.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
}

function applyProfileRankResetButtonState() {
    const enrolledInAge = isCommanderEnrolledInActiveAgeRound();
    document.querySelectorAll('.rank-reset-action-btn').forEach((btn) => {
        btn.disabled = !enrolledInAge;
        btn.classList.toggle('rank-reset-disabled', !enrolledInAge);
        if (!enrolledInAge) {
            btn.setAttribute('aria-disabled', 'true');
            btn.title = 'Available only while enrolled in an active Age round.';
        } else {
            btn.removeAttribute('aria-disabled');
            btn.removeAttribute('title');
        }
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
    body.innerHTML = "Make A Selection";
    
    // 🛑 THE RIGHT PANELS HEADER LOCK: Stays blank on boot up until a choice clicks!
    if (detailsHeader) detailsHeader.innerHTML = "";
    
    // 🛡️ THE LEFT PANELS RESTORATION HOOK: Returns text instantly to the left pane header
    if (leftHeader) {
        leftHeader.innerHTML = (type === 'settings') ? "SETTINGS" : "NATIONS";
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
        // Set the left pane to instantly read CHANNELS on click, right stays empty initially
        if (leftHeader) leftHeader.innerText = "CHANNELS";
        if (detailsHeader) detailsHeader.innerHTML = "";
        
        // FIXED THE CENTER WHEEL LABEL GLOW DISPLAY ACCORDINGLY:
        const centerWheelLabelDisplay = document.getElementById('slot-label-display');
        if (centerWheelLabelDisplay) {
            centerWheelLabelDisplay.innerText = "MESSAGES";
        }
        
        // CORRECTION: Targets the base layout index explicitly to clear out the "undefined" bug!
        body.innerHTML = nationLore.messages[0].detail;
        container.innerHTML = "";
        
        const tabNamesMapping = ["Send Message", "Inbox", "System Messages", "Drafts"];
        const trackIdentifiers = ["send", "inbox", "system", "drafts"];
        
        trackIdentifiers.forEach((trackKey, idx) => {
            const btn = document.createElement('div');
            btn.className = subnavItemClass;
            btn.innerText = tabNamesMapping[idx];
            if (idx === 0) btn.classList.add('active');
            btn.onclick = () => {
                if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
                markHubChannelTabActive(btn, container);

                // Render the precise inner panel template matching your clicked tab row index
                body.innerHTML = nationLore.messages[idx].detail;
                
                // Left pane stays constant, right details title reveals on sub-tab click
                if (leftHeader) leftHeader.innerText = "CHANNELS";
                if (detailsHeader) detailsHeader.innerHTML = tabNamesMapping[idx].toUpperCase();
                
                if (trackKey !== 'send') {
                    clearMessageComposeContext();
                    renderDossierPortalListHTML(trackKey);
                } else {
                    const drawer = document.getElementById('msg-directory-floating-drawer');
                    if (drawer) drawer.className = 'msg-floating-drawer-hidden';
                    if (!messageComposeApplyingFromDossier) {
                        clearMessageComposeContext();
                    }
                }
            };
            container.appendChild(btn);
        });
        
        // 🔒 UNIFIED TIMEOUT CLOSURE HOOKS:
        // Safely closes your dropdown and pre-caches mailbox lists inside one clean thread loop
        setTimeout(() => {
            const drawer = document.getElementById('msg-directory-floating-drawer');
            if (drawer) {
                drawer.className = 'msg-floating-drawer-hidden';
            }
            // Safely initialize lists in background arrays so dynamic items are logged
            if (typeof renderDossierPortalListHTML === 'function') {
                renderDossierPortalListHTML('inbox');
                renderDossierPortalListHTML('system');
                renderDossierPortalListHTML('drafts');
            }
        }, 15);
        return;
    }
    
    // ==========================================================================
    // 👤 INTERCEPT INTEGRATION 2: COMMANDER CUSTOMIZATION DASHBOARD WINDOW
    // ==========================================================================
    if (nationLore[type]) {
        if (type === 'profile' || (nationLore[type] && nationLore[type].name === "PROFILE_FULLSCREEN_MODE") || (nationLore[type][0] && nationLore[type][0].name === "PROFILE_FULLSCREEN_MODE")) {
            syncPlayerFromActiveCommanderStorage();
            if (modalFrame) modalFrame.classList.add(profileActiveClass);
            if (detailsHeader) detailsHeader.style.display = 'none';
            if (leftHeader) leftHeader.style.display = 'none';
            
            const friendsListHTML = player.friends.length > 0
                ? player.friends.map(f => `
                    <div class="alliance-capsule-badge" title="Allied Commander: ${f}">
                        <span class="capsule-icon-shield">🛡️</span>
                        <span class="capsule-username-text">${f}</span>
                    </div>
                `).join('')
                : `<div class="empty-roster-txt">No active wartime alliances recorded.</div>`;
                
            const blockedListHTML = player.blocked.length > 0
                ? player.blocked.map(b => `
                    <div class="alliance-capsule-badge capsule-exiled-border" title="Exiled Faction: ${b}">
                        <span class="capsule-icon-shield">❌</span>
                        <span class="capsule-username-text blocked-txt">${b}</span>
                    </div>
                `).join('')
                : `<div class="empty-roster-txt">No rogue factions blacklisted.</div>`;
                
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
                        <div id="avatar-preset-selection-bin" style="display: none;">
                            <div class="avatar-selection-header">Select Identity Emblem</div>
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
                            <button class="settings-btn mini-btn close-armory-btn" onclick="closeAvatarArmorySelector(event)">Return</button>
                        </div>
                    </div>
                    <div class="profile-header-identity-group">
                        <div class="profile-identity-title-row">
                            <span class="profile-main-name">${player.name}</span>
                            <span class="membership-badge tier-${player.membershipTitle.toLowerCase()}">${player.membershipTitle} Member</span>
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
                            <div class="profile-section-box">
                                <label class="settings-label">Player Bio</label>
                                <div class="bio-bezel-frame-wrapper">
                                    <textarea id="profile-bio-input" maxlength="250" placeholder="Chronicle your achievements, Commander..." oninput="hasUnsavedChanges=true; player.description=this.value;" onchange="hasUnsavedChanges=true; player.description=this.value;">${player.description}</textarea>
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
                                    <label class="settings-label">Wartime Alliances (${player.friends.length})</label>
                                    <div class="compact-grid-scroll-track" id="friends-list-bin">${friendsListHTML}</div>
                                </div>
                                <div class="social-list-box-expanded">
                                    <label class="settings-label">Exiled Factions (${player.blocked.length})</label>
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
                                <button class="settings-btn" onclick="manageSecurityUpdate('password')">Change Encryption Password</button>
                            </div>
                        </div>
                        <div class="profile-section-box footer-box-third">
                            <label class="settings-label">System Enforcement Simulator</label>
                            <div class="profile-btn-row-stacked">
                                <button class="settings-btn" style="border-color: #cc0000 !important; color: #ff9999 !important;" onclick="checkSystemLoginPenalties()">Simulate Account Verification Login</button>
                            </div>
                        </div>
                        <div class="profile-section-box footer-box-third">
                            <label class="settings-label">Rank Reset</label>
                            <div class="profile-btn-row-stacked">
                                <button type="button" class="settings-btn rank-reset-action-btn" onclick="triggerCommanderSuicide('rank')">Sacrifice Commander Rank</button>
                                <button type="button" class="settings-btn rank-reset-action-btn" onclick="triggerCommanderSuicide('exile')">Suicide Out of Active Country</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const profileFooter = document.createElement('div');
            profileFooter.id = 'profile-fullscreen-action-footer';
            profileFooter.className = 'settings-controls profile-fullscreen-controls';
            profileFooter.innerHTML = `
                <button class="confirm-btn" onclick="saveSettings()">Save Changes</button>
                <button class="revert-btn" onclick="revertSettings()">Undo Changes</button>
            `;
            const footerHost = mount.profileFooterHost || paneRight;
            if (footerHost) footerHost.appendChild(profileFooter);
            applyProfileRankResetButtonState();
            return;
        }
        
        // ==========================================================================
        // 📚 FALLBACK LAYER 3: ORIGINAL CORE COMPILING LOOPS (NATIONS/SETTINGS ARRAYS)
        // ==========================================================================
        let printedHeaders = { northern: false, desert: false };
        nationLore[type].forEach(item => {
            const containerBox = container;
            if (!containerBox) return;
            
            if (type === 'nations') {
                if ((item.name === "Aesthene" || item.name === "Vaelior") && !printedHeaders.northern) {
                    printedHeaders.northern = true;
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'scrollable-list-zone-title';
                    headerDiv.innerText = "NORTHERN ALLIANCES";
                    containerBox.appendChild(headerDiv);
                }
                else if ((item.name === "Solaria" || item.name === "Kaelen") && !printedHeaders.desert) {
                    printedHeaders.desert = true;
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'scrollable-list-zone-title';
                    headerDiv.innerText = "DESERT REALMS";
                    containerBox.appendChild(headerDiv);
                }
            }
            
            const div = document.createElement('div');
            div.className = subnavItemClass;
            div.innerText = item.name;
            div.onclick = () => {
                markHubChannelTabActive(div, containerBox);
                if (currentNarration) {
                    if (!currentNarration.src.includes('background_music') && !currentNarration.isAmbientTrack) {
                        currentNarration.pause();
                        currentNarration.currentTime = 0;
                        currentNarration = null;
                    }
                }
                body.innerHTML = item.detail;
                
                // 💡 DYNAMIC RE-ASSIGNMENT: Headers reveal only when a specific list option item is clicked!
                if (leftHeader) leftHeader.innerText = (type === 'settings') ? "SETTINGS" : "NATIONS";
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
                
                if (item.audio && detailsHeader) {
                    const playBtn = document.createElement('span');
                    playBtn.innerHTML = "► ";
                    playBtn.className = "narration-btn";
                    playBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (currentNarration && currentNarration.src.includes(item.audio) && !currentNarration.paused) {
                            currentNarration.pause();
                            currentNarration.currentTime = 0;
                            playBtn.innerHTML = "► ";
                            return;
                        }
                        if (currentNarration) {
                            if (!currentNarration.src.includes('background_music') && !currentNarration.isAmbientTrack) {
                                currentNarration.pause();
                                currentNarration.currentTime = 0;
                            }
                            document.querySelectorAll('.narration-btn').forEach(btn => btn.innerHTML = "► ");
                        }
                        currentNarration = new Audio(item.audio);
                        let activeBaseVolume = 0.7;
                        if (item.name === "Aesthene") activeBaseVolume = 0.4;
                        else if (item.name === "Vaelior") activeBaseVolume = 0.6;
                        currentNarration.volume = activeBaseVolume * confirmedNarrationVol * confirmedMasterVol;
                        playBtn.innerHTML = "■ ";
                        currentNarration.play();
                        currentNarration.onended = () => {
                            playBtn.innerHTML = "► ";
                            currentNarration = null;
                        };
                    };
                    detailsHeader.prepend(playBtn);
                }
            };
            containerBox.appendChild(div);
        });

        if (type === 'settings' && container && container.firstElementChild) {
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

/* --- Block 20: Tactical Scroll Engine --- */
function scrollNations(direction) {
    const container = document.getElementById('lore-titles-container');
    if (!container) return;

    // MATH: 50px (button height) + 12px (margin) = 62px
    const scrollAmount = 62; 

    if (direction === 'up') {
        container.scrollTop -= scrollAmount;
    } else {
        container.scrollTop += scrollAmount;
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

function stageTextScale(val) {
    stagedTextScale = applyTextScaleToDocument(val);
}

function stageUIScale(val) {
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

function toggleHighContrast() {
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
    const hubModal = document.getElementById('commander-hub-modal');
    if (hubModal && hubModal.classList.contains('is-visible')) {
        return hubModal.querySelector('.commander-hub-dialog') || hubModal;
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
    const cachedBio = localStorage.getItem('savedCommanderBio');
    return cachedBio !== null ? cachedBio.trim() : '';
}

function captureProfilePrivacyFromEditor() {
    const privacyCheck = document.getElementById('privacy-toggle-check');
    if (privacyCheck) {
        return privacyCheck.checked ? 'Public' : 'Private';
    }
    if (typeof player !== 'undefined' && (player.privacy === 'Public' || player.privacy === 'Private')) {
        return player.privacy;
    }
    const cachedPrivacy = localStorage.getItem('savedCommanderPrivacy');
    return cachedPrivacy === 'Private' ? 'Private' : 'Public';
}

function persistProfileFieldsFromEditor() {
    if (typeof player === 'undefined') return false;

    const nextBio = captureProfileBioFromEditor();
    const nextPrivacy = captureProfilePrivacyFromEditor();

    player.description = nextBio;
    player.privacy = nextPrivacy;
    localStorage.setItem('savedCommanderBio', nextBio);
    localStorage.setItem('savedCommanderPrivacy', nextPrivacy);

    return true;
}

function saveSettings() { 
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    setTimeout(() => {
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

        localStorage.setItem('savedPortalMasterVol', confirmedMasterVol);
        localStorage.setItem('savedPortalMusicVol', confirmedMusicVol);

        const savedProfile = persistProfileFieldsFromEditor();
        hasUnsavedChanges = false;

        const hubModal = document.getElementById('commander-hub-modal');
        if (savedProfile && hubModal?.classList.contains('commander-hub-profile-active') && typeof reloadProfilePanelView === 'function') {
            reloadProfilePanelView();
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

        showSaveChangesConfirmation(
            savedProfile
                ? 'Profile and settings changes have been saved.'
                : 'Your changes have been saved.'
        );
    }, 10);
} 

/* --- Block 24: Font Accessibility Controller (alias) --- */ 

function revertSettings() { 
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

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
        confirmedNarrationVol = 0.7; 
        stagedNarrationVol = 0.7; 
        confirmedSfxVol = 0.2; 
        stagedSfxVol = 0.2; 
        
        confirmedVerbosity = "Detailed"; stagedVerbosity = "Detailed"; 
        confirmedPings = "Enabled"; stagedPings = "Enabled"; 
        confirmedSafetyLock = "Double-Click"; stagedSafetyLock = "Double-Click"; 
        
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
        if (narrationSlider) narrationSlider.value = 0.7; 
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
window.syncPlayerFromActiveCommanderStorage = syncPlayerFromActiveCommanderStorage;
window.refreshProfileCommanderNameDisplay = refreshProfileCommanderNameDisplay;
window.refreshLoggedUserTagDisplay = refreshLoggedUserTagDisplay;
window.showSaveChangesConfirmation = showSaveChangesConfirmation;
window.hideSaveChangesConfirmation = hideSaveChangesConfirmation;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncPlayerFromActiveCommanderStorage);
} else {
    syncPlayerFromActiveCommanderStorage();
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
            <div class="safety-alert-title">Unsealed Manuscripts</div> 
            <div class="safety-alert-message"> 
                Commander, your interface adjustments have not been sealed within the Aether. Leaving now will permanently discard these configurations. 
            </div> 
            <div class="safety-alert-actions"> 
                <button class="safety-alert-btn discard" onclick="executeWarningBypass()">Discard Changes</button> 
                <button class="safety-alert-btn stay" onclick="dismissWarningModal()">Return to Console</button> 
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

function manageSecurityUpdate(type) { 
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX(); 
    showAetherWarningModal(() => { 
        console.log(`Security gateway access granted for: ${type}`); 
    }); 
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
            buttons: [{ text: "Reset Rank", action: "commit" }, { text: "RETREAT", action: "close" }]
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
            buttons: [{ text: "Suicide", action: "commit" }, { text: "OKAY, FINE", action: "close" }]
        },
        {
            text: "Record of your existence has been purged completely and your Commander status, dissolved.",
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
    if ((mode === 'rank' || mode === 'exile') && !isCommanderEnrolledInActiveAgeRound()) {
        return;
    }

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    // 1. Map the active branch identifier safely into memory
    currentSuicideMode = mode;
    currentSuicideStep = 0;
    
    const overlay = document.getElementById('commander-suicide-overlay');
    if (overlay) {
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
    } else if (action === 'finalize') {
        // Clear variables, commit changes to disk memory cache records, re-render, and clear the screen
        hasUnsavedChanges = false;
        localStorage.removeItem('savedCommanderInActiveAge');
        if (typeof notifyPortalAgeSessionLeave === 'function') notifyPortalAgeSessionLeave();
        if (typeof saveSettings === 'function') saveSettings();
        reloadProfilePanelView();

        closeSuicideOverlayWindow();
    }
}

function closeSuicideOverlayWindow() {
    const overlay = document.getElementById('commander-suicide-overlay');
    if (overlay) {
        // 1. Forcefully lock down direct hardware display properties back to silent zero
        overlay.style.setProperty('display', 'none', 'important');
        
        // 2. Re-apply the global style blueprint backup mask classes
        overlay.classList.add('suicide-overlay-hidden');
    }
    currentSuicideMode = null;
    currentSuicideStep = 0;
}

/* --- Block 31: Unified Avatar Customization Controllers --- */
function openAvatarArmorySelector(e) {
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const activeView = document.getElementById('avatar-active-display-group');
    const selectorBin = document.getElementById('avatar-preset-selection-bin');
    
    if (activeView) activeView.style.display = 'none';
    if (selectorBin) selectorBin.style.display = 'block';
}

function closeAvatarArmorySelector(e) {
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const activeView = document.getElementById('avatar-active-display-group');
    const selectorBin = document.getElementById('avatar-preset-selection-bin');
    
    if (activeView) activeView.style.display = 'block';
    if (selectorBin) selectorBin.style.display = 'none';
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
    
    closeAvatarArmorySelector();
}

/* --- MESSAGE COMPOSE: REPLY / FORWARD CONTEXT --- */
function escapeMessageHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
            appendRecipientPill(msg.from);
            const subject = document.getElementById('msg-subject-input-element');
            if (subject) subject.value = normalizeReplyTopic(msg.topic);
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
function toggleRecipientDirectory(e) {
    if (messageComposeMode === 'reply') return;
    if (e) e.stopPropagation();
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const drawer = document.getElementById('msg-directory-floating-drawer');
    if (!drawer) return;
    
    if (drawer.classList.contains('msg-floating-drawer-hidden')) {
        drawer.classList.remove('msg-floating-drawer-hidden');
        drillDownDirectory('root'); // Re-initialize map menu parameters
        resetRecipientDrawerScrollPosition();
        
        // WIRE UP GLOBAL CLICK LATCH DISMISSAL PASS
        document.addEventListener('click', closeRecipientDrawerOutsideDismissalLatch);
    } else {
        hideRecipientDirectoryDrawer();
    }
}

function hideRecipientDirectoryDrawer() {
    const drawer = document.getElementById('msg-directory-floating-drawer');
    if (drawer) drawer.classList.add('msg-floating-drawer-hidden');
    document.removeEventListener('click', closeRecipientDrawerOutsideDismissalLatch);
}

function closeRecipientDrawerOutsideDismissalLatch(e) {
    const drawer = document.getElementById('msg-directory-floating-drawer');
    const addBtn = document.querySelector('.msg-recipient-add-btn');
    if (drawer && !drawer.contains(e.target) && e.target !== addBtn) {
        hideRecipientDirectoryDrawer();
    }
}

function resetRecipientDrawerScrollPosition() {
    const mainPane = document.getElementById('drawer-main-category-view');
    const drillPane = document.getElementById('drawer-drilldown-category-view');
    if (mainPane) mainPane.scrollTop = 0;
    if (drillPane) drillPane.scrollTop = 0;
}

function drillDownDirectory(tier, payload) {
    const mainPane = document.getElementById('drawer-main-category-view');
    const drillPane = document.getElementById('drawer-drilldown-category-view');
    if (!mainPane || !drillPane) return;

    if (tier === 'root') {
        mainPane.classList.remove('msg-drawer-pane-hidden');
        drillPane.classList.add('msg-drawer-pane-hidden');
        resetRecipientDrawerScrollPosition();
        return;
    }

    // Collapse category root view to open drilldown canvas area layout
    mainPane.classList.add('msg-drawer-pane-hidden');
    drillPane.classList.remove('msg-drawer-pane-hidden');
    drillPane.innerHTML = `<div class="drawer-back-node-row" onclick="drillDownDirectory('root')">◀ Back to Radar Tracks</div>`;

    /* --- PARSE TIER A: NATIVE SOVEREIGN COUNTRY REALM --- */
    if (tier === 'country') {
        const data = globalFactionServerDirectory.country;
        drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('Country: All Players')">📢 All Players (${data.name})</div>`;
        drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('Country: Royal Council')">👑 Royal Council Leaders</div>`;
        data.players.forEach(p => {
            if (p !== player.name) {
                drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${p}')">👤 ${p}</div>`;
            }
        });
    }
    /* --- PARSE TIER B: NATIVE INTERNATIONAL COUNTRY ALLIES SYSTEM --- */
    else if (tier === 'allies') {
        if (!payload) {
            // First step view inside Allies category: Print selectable ally country matrices
            globalFactionServerDirectory.allies.forEach((allyNation, index) => {
                drillPane.innerHTML += `<div class="drawer-node-row" onclick="drillDownDirectory('ally-nation', ${index})">🤝 ${allyNation.name} Sector <span>►</span></div>`;
            });
        }
    }
    else if (tier === 'ally-nation') {
        const allyNation = globalFactionServerDirectory.allies[payload];
        drillPane.innerHTML = `<div class="drawer-back-node-row" onclick="drillDownDirectory('allies')">◀ Back to Allies list</div>`;
        drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('Allies: All ${allyNation.name}')">📢 All Players (${allyNation.name})</div>`;
        drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('Allies: Council ${allyNation.name}')">👑 Council Leaders (${allyNation.name})</div>`;
        allyNation.players.forEach(p => {
            drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${p}')">👤 ${p}</div>`;
        });
    }
    /* --- PARSE TIER C: SPAM PROTECTED LONE OPERATIONS TRACKS --- */
    else if (tier === 'other') {
        globalFactionServerDirectory.other.forEach(p => {
            drillPane.innerHTML += `<div class="drawer-node-row selection-action-node" onclick="appendRecipientPill('${p}')">👤 ${p}</div>`;
        });
    }

    resetRecipientDrawerScrollPosition();
}

function appendRecipientPill(targetName) {
    if (messageComposeMode === 'reply') return;
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
        document.getElementById('msg-recipient-pill-dock').innerHTML = `<span class="pill-placeholder-txt">Select recipients using the compass array...</span>`;
    }
}

/* --- DISPATCH EXECUTION WORKER FLOWS --- */
function executeOutgoingMessageDispatch() {
    const topic = document.getElementById('msg-subject-input-element').value.trim();
    const bodyText = document.getElementById('msg-body-input-element').value.trim();

    if (activeWartimeRecipients.length === 0 || !topic || !bodyText) {
        alert("Diplomatic error: Target pathways, headers, and body matrices must be completely specified.");
        return;
    }

    alert(`Dispatch unsealed! Outgoing signal broadcast successfully routed to: ${activeWartimeRecipients.join(', ')}`);
    
    clearMessageComposeContext();
    resetMessageComposeFields();
}

function commitMessageToDraftCache() {
    const topic = document.getElementById('msg-subject-input-element').value.trim() || "Untitled Draft";
    const bodyText = document.getElementById('msg-body-input-element').value.trim() || "";

    playerDraftsInboxDossier.unshift({
        id: Date.now(),
        recipients: [...activeWartimeRecipients],
        topic: topic,
        body: bodyText
    });

    alert("Composition secured inside your drafts tracking scroll lists.");
    reloadMessagesPanelView();
}

function renderDossierPortalListHTML(targetTrack) {
    const bin = document.getElementById(`msg-${targetTrack}-render-dock`);
    if (!bin) return;
    bin.innerHTML = "";
    
    let dataSet = [];
    if (targetTrack === 'inbox') dataSet = playerInboundInboxDossier;
    else if (targetTrack === 'system') dataSet = playerSystemInboxDossier;
    else if (targetTrack === 'drafts') dataSet = playerDraftsInboxDossier;
    
    // TARGET HARDWIRED CONSOLE TOOLBARS
    const prefix = targetTrack === 'inbox' ? 'msg' : 'sys';
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
        bin.innerHTML = `<div class="empty-roster-txt" style="padding:20px !important;">This document registry is currently vacant, Commander.</div>`;
        return;
    }
    
    dataSet.forEach(msg => {
        const row = document.createElement('div');
        row.className = `msg-dossier-summary-row ${msg.read ? 'msg-dossier-read' : 'msg-dossier-unread'}`;
        row.onclick = () => openFocusedDossierReadingOverlay(msg, targetTrack);
        
        let metaSender = msg.from ? msg.from : `To: ${msg.recipients.join(', ')}`;
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
        bin.appendChild(row);
    });
}

/* --- HIGH FANTASY POPUP DISPATCH READING WINDOW --- */
function openFocusedDossierReadingOverlay(msg, track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    // Mark as read natively inside arrays
    msg.read = true;
    renderDossierPortalListHTML(track);

    // Reuse your absolute body center overlay layer blueprints for reading popups
    const overlay = document.getElementById('commander-suicide-overlay');
    const textField = document.getElementById('suicide-popup-text-field');
    const btnDock = document.getElementById('suicide-popup-btn-dock');

    if (!overlay || !textField || !btnDock) return;

    // Inject letter text layout formats inside your golden bezel
    textField.innerHTML = `
        <div style="text-align:left !important; font-family:'Segoe UI',sans-serif; color:#f1e0ac; font-size:0.8rem; border-bottom:1px solid rgba(184,144,48,0.2); padding-bottom:8px; margin-bottom:12px;">
            <strong>FROM:</strong> ${msg.from || 'Unsent Draft Record'}<br>
            <strong>TOPIC:</strong> ${msg.topic}
        </div>
        <div style="text-align:center !important; font-family:'Segoe UI',sans-serif; color:#ffffff; font-size:0.85rem; line-height:1.5; min-height:80px; max-height:180px; overflow-y:auto; padding:5px;">
            "${msg.body}"
        </div>
    `;

    btnDock.innerHTML = "";

    if (track === 'inbox') {
        const replyBtn = document.createElement('button');
        replyBtn.className = 'suicide-danger-confirm-btn';
        replyBtn.innerText = 'REPLY DISPATCH';
        replyBtn.style.borderColor = '#b89030';
        replyBtn.onclick = () => openMessageComposeFromDossier(msg, 'reply');
        btnDock.appendChild(replyBtn);

        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'suicide-danger-confirm-btn';
        forwardBtn.innerText = 'FORWARD DISPATCH';
        forwardBtn.style.borderColor = '#6a8fc7';
        forwardBtn.onclick = () => openMessageComposeFromDossier(msg, 'forward');
        btnDock.appendChild(forwardBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'suicide-danger-confirm-btn';
    deleteBtn.innerText = "DELETE DISPATCH";
    deleteBtn.onclick = () => {
        if (track === 'inbox') playerInboundInboxDossier = playerInboundInboxDossier.filter(m => m.id !== msg.id);
        else if (track === 'system') playerSystemInboxDossier = playerSystemInboxDossier.filter(m => m.id !== msg.id);
        else if (track === 'drafts') playerDraftsInboxDossier = playerDraftsInboxDossier.filter(m => m.id !== msg.id);
        
        closeSuicideOverlayWindow();
        renderDossierPortalListHTML(track);
    };

    const returnBtn = document.createElement('button');
    returnBtn.className = 'suicide-safe-retreat-btn';
    returnBtn.innerText = "CLOSE LOG";
    returnBtn.onclick = () => closeSuicideOverlayWindow();

    btnDock.appendChild(deleteBtn);
    btnDock.appendChild(returnBtn);

    overlay.style.setProperty('display', 'flex', 'important');
    overlay.classList.remove('suicide-overlay-hidden');
}

/* --- MASS DELETION CHECKBOX DRIVER SYSTEMS --- */
function toggleMassDeletionMode(track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    isMassDeletionActive[track] = !isMassDeletionActive[track];
    renderDossierPortalListHTML(track);

    // Toggle toolbars visibility configurations inside your document grid
    const prefix = track === 'inbox' ? 'msg' : 'sys';
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
    const checkboxes = document.querySelectorAll(`#msg-${track}-render-dock .msg-purge-checkbox-lever`);
    checkboxes.forEach(box => box.checked = true);
}

function executeMassDossierPurge(track) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    
    const checkboxes = document.querySelectorAll(`#msg-${track}-render-dock .msg-purge-checkbox-lever:checked`);
    if (checkboxes.length === 0) return;

    const idsToPurge = Array.from(checkboxes).map(box => parseInt(box.getAttribute('data-id')));

    if (track === 'inbox') playerInboundInboxDossier = playerInboundInboxDossier.filter(m => !idsToPurge.includes(m.id));
    else if (track === 'system') playerSystemInboxDossier = playerSystemInboxDossier.filter(m => !idsToPurge.includes(m.id));

    isMassDeletionActive[track] = false;
    toggleMassDeletionMode(track); // Revert toolbars toggles back to base properties
    renderDossierPortalListHTML(track);
    alert(`Purged ${idsToPurge.length} historical diplomatic entries completely from system disk cache.`);
}
/**
 * script.js - Royal Armies
 * The RAGE (Royal Armies Game Engine) Framework
 * Primary Logic Controller for the AVI Interface
 */

/* ============================================================
   TOP: BRIDGE PART 1
   ============================================================ */

var handleLogin;
var selectClass;
var confirmSelection;

/* ============================================================
   SECTION 0: GLOBAL STATE & SAFETY NETS
   ============================================================ */

if (typeof groundRanks === 'undefined') {
    var groundRanks = {
        "1": { title: "Recruit", max_slots: 100 },
        "2": { title: "Soldier", max_slots: 200 }
    };
}

if (typeof unitDatabase === 'undefined') {
    var unitDatabase = { "INFANTRY": {} };
}

let selectedClassId = null;
let narrativeFinished = false; 

var player = {
    name: "Commander Name",
    rank: 1,
    path: "PHYS",
    gold: 1000,
    xp: 0,
    terrain: "Standard",
    army: []
};

var currentSFChain = [];
var battleHoldInterval = null;
var holdTimer = null;

/* ============================================================
   SECTION 1: INITIALIZATION & EVENT LISTENERS
   ============================================================ */

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
        music.volume = 1.0; 
        music.play().then(() => console.log("Stone and Water Authorized."))
            .catch(() => console.log("Interaction required for audio."));
    }
    // Remove listeners after first successful interaction
    ['click', 'keydown', 'mousedown', 'touchstart'].forEach(e => 
        document.removeEventListener(e, unlockAudio));
};

['click', 'keydown', 'mousedown', 'touchstart'].forEach(e => 
    document.addEventListener(e, unlockAudio, { once: true }));

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
    const initInterval = setInterval(() => {
        // Only stops looking once game data variables are found in memory
        if (typeof groundRanks !== 'undefined' && typeof unitDatabase !== 'undefined') {
            clearInterval(initInterval);
            if (typeof initDashboard === "function") initDashboard();
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

/* ============================================================
   SECTION 2: AUTHENTICATION & LOGIN FLOW
   ============================================================ */

// --- THE CHRONICLE ARCHIVES ---
const CHRONICLE_DATA = {
    genesis: { title: "The Genesis Forge", details: "The birth of the project. Established the core Aether-Rage framework, the obsidian and gold visual theme, and the dynamic background slideshow engine." },
    audio: { title: "Symphony of War", details: "Integrated the spatial audio engine featuring 'Stone and Water.' Developed custom sticky audio controls and mute logic." },
    narrative: { title: "The Traveler's Guidance", details: "Built the Narrative System and the mysterious 'Retired Old Man' portrait interaction. Engineered the typing text effect." },
    interface: { title: "Navigator & Roadmap", details: "Deployed the Widescreen Roadmap system (95vw) with Star Citizen-inspired 'Deep Dive' expansion logic." },
    security: { title: "Nexus Gatekeeping", details: "Established the Secure Login Engine. Developed the Developer Override (Skeleton Key) bypass system for rapid testing." },
    assets: { title: "GIMP Asset Integration", details: "A massive refinement phase. Merged logos and stone frames into single-load assets in GIMP to eliminate scaling lag." }
};

// --- 1. THE LOGIN ENGINE (Local Only - Pre-Release Mode) ---
async function handleLogin() {
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;
    
    // Admin Credentials Check
    const isAdmin = (userVal === "IAmBeyondLegend" && passVal === "Tor1pedo01!");

    // Visual loading state
    const loader = document.getElementById('auth-loading');
    if (loader) loader.style.display = 'block';

    // SUCCESS SIMULATION: Processing locally
    setTimeout(() => {
        if (userVal !== "" && passVal !== "") {
            // Song does NOT swap yet. Transition to message begins.
            initiatePostLoginSequence(isAdmin);
        } else {
            alert("Please provide credentials to the Gatekeepers.");
            if (loader) loader.style.display = 'none';
        }
    }, 800);
}

// --- 2. POST-LOGIN TRANSITION (Fanbase Message) ---
function initiatePostLoginSequence(isAdmin) {
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');

    // 2A. Fade out Login UI
    if(loginWrapper) loginWrapper.style.opacity = '0';
    if(authButtons) authButtons.style.opacity = '0';

    setTimeout(() => {
        if(loginWrapper) loginWrapper.style.display = 'none';
        if(authButtons) authButtons.style.display = 'none';

        // 2B. Reveal the Pre-Release Message
        if(messageBox) {
            messageBox.style.display = 'block';
            messageBox.offsetHeight; // Force browser reflow
            messageBox.style.opacity = '1';
        }

        // 2C. Pulse the Discord Icon for attention
        if(discordIcon) {
            discordIcon.classList.remove('disabled');
            discordIcon.classList.add('pulse-discord');
        }

        // 2D. Show Admin Bypass Button if credentials match
        if (isAdmin && bypassBtn) {
            bypassBtn.style.display = 'block';
        }
    }, 1000);
}

// --- 3. ADMIN BYPASS (The actual entry to selection) ---
function enterMainGame() {
    // Song Swaps ONLY when entering the game
    if (typeof playLoginMusic === "function") {
        playLoginMusic(); 
    }

    // Hide Landing and Reveal the Statues
    const landing = document.getElementById('page-landing');
    const statues = document.getElementById('class-selection-screen');
    
    if(landing) landing.style.display = 'none';
    if(statues) statues.style.display = 'flex';
    
    console.log("Welcome to the Hall of Statues, Commander Beyond Legend.");
}

// --- 4. DISCORD REDIRECT ---
function openDiscord() {
    const discordIcon = document.getElementById('nav-discord');
    // Logic only allows activation if the icon is pulsing (logged in)
    if (discordIcon && discordIcon.classList.contains('pulse-discord')) {
        window.open('https://discord.gg', '_blank'); 
    }
}

/* --- UI UTILITIES --- */
function openChronicleDetail(id) {
    const data = CHRONICLE_DATA[id];
    const modal = document.getElementById('chronicle-detail-modal');
    const titleEl = document.getElementById('chronicle-detail-title');
    const textEl = document.getElementById('chronicle-detail-text');
    if (!data || !modal) return;
    titleEl.innerText = data.title;
    textEl.innerText = data.details;
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);
}

function closeChronicleDetail() {
    const modal = document.getElementById('chronicle-detail-modal');
    if (modal) { 
        modal.style.opacity = '0'; 
        setTimeout(() => { modal.style.display = 'none'; }, 300); 
    }
}

function toggleUpdates() {
    const panel = document.getElementById('updates-panel');
    if (panel) panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
}

function toggleRoadmap(show) {
    const modal = document.getElementById('roadmap-modal');
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    } else {
        modal.style.opacity = '0';
        document.querySelectorAll('.roadmap-phase').forEach(card => card.classList.remove('expanded'));
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

function expandCard(cardElement) {
    const isExpanded = cardElement.classList.contains('expanded');
    document.querySelectorAll('.roadmap-phase').forEach(card => card.classList.remove('expanded'));
    if (!isExpanded) {
        cardElement.classList.add('expanded');
        setTimeout(() => { cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 300);
    }
}

function handleRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'flex';
}

function closeRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'none';
}

/* ============================================================
   SECTION 3: CINEMATIC & NARRATIVE ENGINES
   ============================================================ */



/* ============================================================
   SECTION 5: HUD & PAGE MANAGEMENT
   ============================================================ */



/* ============================================================
   SECTION 6: Army Management & Recruitment
   ============================================================ */



/* ============================================================
   SECTION 7: Battle Simulation & Resolve
   ============================================================ */



/* ============================================================
   SECTION 8: SESSION CONTROL
   ============================================================ */

function handleLogout() {
    const landing = document.getElementById('page-landing');
    if (landing) {
        landing.style.display = "flex";
        setTimeout(() => {
            landing.style.transition = "opacity 1.5s ease";
            landing.style.opacity = "1";
        }, 10);
    }
    // Optional: Reset player state here if needed
    // selectedClassId = null;
}

/* ============================================================
   BOTTOM: BRIDGE PART 2
   ============================================================ */

window.handleLogin = handleLogin;
window.confirmSelection = confirmSelection;
window.selectClass = selectClass;
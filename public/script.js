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

/* --- Block 1: The Chronicle Archives (Full Data Set) --- */
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

/* --- Block 2: The Master Close Protocol (The UI Sync) --- */
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

/* --- Block 3: The Login Engine --- */
async function handleLogin() {
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;
    const isAdmin = (userVal === "IAmBeyondLegend" && passVal === "Tor1pedo01!");
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) { authButtons.style.display = 'none'; authButtons.style.opacity = '0'; }
    const loader = document.getElementById('auth-loading');
    if (loader) loader.style.display = 'block';
    setTimeout(() => {
        if (userVal !== "" && passVal !== "") {
            initiatePostLoginSequence(isAdmin);
        } else {
            alert("Please provide credentials to the Gatekeepers.");
            if (loader) loader.style.display = 'none';
            if (authButtons) { authButtons.style.display = 'flex'; authButtons.style.opacity = '1'; }
        }
    }, 800);
}

/* --- Block 4: Post-Login Transition --- */
function initiatePostLoginSequence(isAdmin) {
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');
    if(loginWrapper) loginWrapper.style.opacity = '0';
    if(authButtons) authButtons.style.opacity = '0';
    setTimeout(() => {
        if(loginWrapper) loginWrapper.style.display = 'none';
        if(authButtons) authButtons.style.display = 'none';
        if(messageBox) { messageBox.style.display = 'block'; messageBox.offsetHeight; messageBox.style.opacity = '1'; }
        if(discordIcon) { discordIcon.classList.remove('disabled'); discordIcon.classList.add('pulse-discord'); }
        if (isAdmin && bypassBtn) { bypassBtn.style.display = 'block'; }
    }, 1000);
}

/* --- Block 5: Navigation Toggle Sync --- */
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

/* --- Block 6: Redirects & Modals (Registration & Recovery) --- */

function enterMainGame() {
    if (typeof playLoginMusic === "function") { playLoginMusic(); }
    const landing = document.getElementById('page-landing');
    const statues = document.getElementById('class-selection-screen');
    if(landing) landing.style.display = 'none';
    if(statues) statues.style.display = 'flex';
}

function openDiscord() {
    const discordIcon = document.getElementById('nav-discord');
    if (discordIcon && discordIcon.classList.contains('pulse-discord')) {
        window.open('https://discord.gg', '_blank');
    }
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
        body: JSON.stringify({ username: user, email: email, password: pass })
    })
    .then(response => {
        if (response.ok) {
            alert("Application submitted. Check your email for the confirmation scroll.");
            closeRegister();
        } else {
            alert("The Nexus connection is unstable.");
        }
    })
    .catch(err => console.error("Nexus Link Error:", err));
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

/* --- Block 7: Archive Detail Logic (NEWLY RESTORED) --- */
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

/* --- Block 1: Logout and Portal Reset --- */
function handleLogout() {
    // 1. Target all interactive components
    const loginWrapper = document.getElementById('login-content-wrapper');
    const authButtons = document.getElementById('auth-buttons');
    const messageBox = document.getElementById('post-login-message');
    const discordIcon = document.getElementById('nav-discord');
    const bypassBtn = document.getElementById('admin-bypass-btn');
    const loader = document.getElementById('auth-loading');

    // 2. Hide post-login elements & loader
    if (loader) loader.style.display = 'none';
    
    if (messageBox) { 
        messageBox.style.display = 'none'; 
        messageBox.style.opacity = '0'; 
    }
    if (bypassBtn) bypassBtn.style.display = 'none';
    
    // 3. Deactivate Discord Pulse
    if (discordIcon) {
        discordIcon.classList.remove('pulse-discord');
        discordIcon.classList.add('disabled');
    }

    // 4. Restore Login UI & re-enable button hitboxes
    if (loginWrapper) { 
        loginWrapper.style.display = 'flex'; 
        loginWrapper.style.opacity = '1'; 
    }
    if (authButtons) { 
        authButtons.style.display = 'flex'; 
        authButtons.style.opacity = '1'; 
        authButtons.style.pointerEvents = 'auto'; // Re-enables clicking
    }

    // 5. Original Transition Logic (Landing Page Fade)
    const landing = document.getElementById('page-landing');
    if (landing) {
        landing.style.display = "flex";
        setTimeout(() => {
            landing.style.transition = "opacity 1.5s ease";
            landing.style.opacity = "1";
        }, 10);
    }

    // 6. Security Cleanup: Wipe inputs
    const userIn = document.getElementById('login-username');
    const passIn = document.getElementById('login-password');
    if (userIn) userIn.value = "";
    if (passIn) passIn.value = "";

    console.log("Portal Reset: Authenticating text cleared and UI restored.");
}

/* ============================================================
   BOTTOM: BRIDGE PART 2
   ============================================================ */

window.handleLogin = handleLogin;
window.confirmSelection = confirmSelection;
window.selectClass = selectClass;
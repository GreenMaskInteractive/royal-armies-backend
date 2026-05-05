/**
 * script.js - THE LAST KNIGHTS
 * Master UI & Simulation Controller
 */

const groundRanks = ["Recruit", "Soldier", "Warrior"];
const eventSource = new EventSource('/listen-for-verify');

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.verified) {
        alert("Thank you for joining in the war effort! Your nation awaits you!");
    }
};

// Add this to your existing initialization logic
document.addEventListener('click', function startMusic() {
    const audio = document.getElementById('main-theme');
    if (audio && audio.paused) {
        audio.play().catch(err => console.log("Audio playback waiting for interaction."));
    }
    // Remove this listener after it runs once
    document.removeEventListener('click', startMusic);
}, { once: true });

// --- GLOBAL STATE ---
var player = {
    name: "Commander Name",
    rank: 1, 
    path: "PHYS", // "PHYS" or "MAG"
    gold: 1000,
    xp: 0,
    terrain: "Standard",
    army: [] // Unified pool of current commanders/units
};

var currentSFChain = [];

// --- NEW: BATTLE REPEAT STATE ---
var battleHoldInterval = null;
var holdTimer = null;

// --- INITIALIZATION ---
var initInterval = setInterval(function() {
    if (typeof groundRanks !== 'undefined' && typeof unitDatabase !== 'undefined') {
        console.log("Data Linked. Initializing Dashboard...");
        clearInterval(initInterval);
        initDashboard();
    }
}, 100);

function initDashboard() {
    populateCommanderRanks();
    updateUnitDropdown();
    attachEventListeners();
}

function attachEventListeners() {
    document.getElementById('unit-category').addEventListener('change', updateUnitDropdown);
    document.getElementById('unit-select').addEventListener('change', updateRankDropdown);
    document.getElementById('btn-max').addEventListener('click', handleMaxClick);
    document.getElementById('btn-add-sf').addEventListener('click', addCommanderToChain);
    document.getElementById('btn-clear-sf').addEventListener('click', clearSFChain);
    
    // UPDATED: Support for both standard click and the new "Hold" mechanic
    const battleBtn = document.getElementById('btn-hold-battle');
    if (battleBtn) {
        // Standard click for single battle
        battleBtn.onclick = runUnifiedAssault;
        
        // Hold logic for repeating battles
        battleBtn.onmousedown = startHoldTimer;
        battleBtn.onmouseup = stopHoldTimer;
        battleBtn.onmouseleave = stopHoldTimer;
        
        // Mobile Touch Support
        battleBtn.ontouchstart = startHoldTimer;
        battleBtn.ontouchend = stopHoldTimer;
    }
}

// --- NEW: HOLD TO DEPLOY LOGIC ---
function startHoldTimer(e) {
    if (e.type === 'mousedown' && e.button !== 0) return; // Only left click
    
    const progressBar = document.getElementById('hold-progress-bar');
    if (progressBar) progressBar.style.width = "100%";

    // Wait 1 second before starting the repeat loop
    holdTimer = setTimeout(function() {
        // Start the loop: repeat battle every 1 second
        battleHoldInterval = setInterval(function() {
            runUnifiedAssault();
        }, 1000);
    }, 1000);
}

function stopHoldTimer() {
    const progressBar = document.getElementById('hold-progress-bar');
    if (progressBar) {
        progressBar.style.transition = "none";
        progressBar.style.width = "0%";
        // Restore transition after a frame
        setTimeout(() => { progressBar.style.transition = "width 1s linear"; }, 50);
    }

    clearTimeout(holdTimer);
    clearInterval(battleHoldInterval);
    holdTimer = null;
    battleHoldInterval = null;
}

// --- NAVIGATION & QUESTS ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
}

function startQuest(questType) {
    const rank = player.rank;
    
    // Quest Locking Logic
    if (questType === 'market' && rank > 7) return alert("Rank too high for Market Patrol.");
    if (questType === 'border' && (rank < 7 || rank > 14)) return alert("Requires Rank 7-14.");
    if (questType === 'escort' && (rank < 14 || rank > 18)) return alert("Requires Rank 14-18.");

    // Update Battle Header
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-terrain').textContent = `Terrain: ${player.terrain}`;
    
    showPage('page-battle');
    initializeBattleTable();
}

// --- UI POPULATION ---
function populateCommanderRanks() {
    const rankSelect = document.getElementById('commander-rank');
    if (!rankSelect) return;
    rankSelect.innerHTML = "";
    Object.keys(groundRanks).forEach(lvl => {
        const data = groundRanks[lvl];
        const opt = document.createElement('option');
        opt.value = lvl;
        opt.textContent = `Rank ${lvl}: ${data.title} (${data.max_slots}p)`;
        rankSelect.appendChild(opt);
    });
}

function updateUnitDropdown() {
    const cat = document.getElementById('unit-category').value;
    const unitSelect = document.getElementById('unit-select');
    unitSelect.innerHTML = "";
    Object.keys(unitDatabase[cat]).forEach(uName => {
        const opt = document.createElement('option');
        opt.value = uName; opt.textContent = uName;
        unitSelect.appendChild(opt);
    });
    updateRankDropdown();
}

function updateRankDropdown() {
    const cat = document.getElementById('unit-category').value;
    const unitName = document.getElementById('unit-select').value;
    const rankSelect = document.getElementById('rank-select');
    rankSelect.innerHTML = "";
    const unit = unitDatabase[cat][unitName];
    Object.keys(unit.stats).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r.toUpperCase();
        rankSelect.appendChild(opt);
    });
}

// --- LOGISTICS (MAX BUTTON) ---
function handleMaxClick() {
    const cat = document.getElementById('unit-category').value;
    const unitName = document.getElementById('unit-select').value;
    const unitRank = document.getElementById('rank-select').value;
    const commLevel = document.getElementById('commander-rank').value;

    const unit = unitDatabase[cat][unitName];
    const rankSet = cat.includes("MAGIC") ? magicRanks : groundRanks;
    const cap = rankSet[commLevel].max_slots;
    
    const totalCost = unit.baseProv + unit.stats[unitRank].upc;
    document.getElementById('unit-qty-input').value = Math.floor(cap / totalCost);
}

// --- SF CHAIN & BATTLE TABLE ---
function addCommanderToChain() {
    const cat = document.getElementById('unit-category').value;
    const unitName = document.getElementById('unit-select').value;
    const rank = document.getElementById('rank-select').value;
    const qty = parseInt(document.getElementById('unit-qty-input').value);

    if (qty <= 0 || isNaN(qty)) return alert("Invalid Quantity");

    currentSFChain.push({
        commanderId: currentSFChain.length + 1,
        army: [{ class: cat, name: unitName, rank: rank, qty: qty }]
    });
    renderSFUI();
}

function initializeBattleTable() {
    const tableBody = document.getElementById('battle-stats-body');
    const classes = ['Artillery', 'Beasts', 'Cavalry', 'Infantry'];
    tableBody.innerHTML = "";
    classes.forEach(cls => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cls}</td><td id="p-${cls}-un">0</td><td id="p-${cls}-in">0</td><td id="p-${cls}-de">0</td><td id="p-${cls}-ca">0</td>
            <td class="table-spacer"></td>
            <td>${cls}</td><td id="e-${cls}-un">0</td><td id="e-${cls}-in">0</td><td id="e-${cls}-de">0</td><td id="e-${cls}-ca">0</td>
        `;
        tableBody.appendChild(row);
    });
}

// --- BATTLE EXECUTION ---
function runUnifiedAssault() {
    if (currentSFChain.length === 0) {
        stopHoldTimer(); // Stop auto-battle if army is gone
        return alert("SF Chain Empty");
    }
    const target = { 
        hp: document.getElementById('city-hp').value, 
        str: document.getElementById('city-str').value, 
        primaryType: document.getElementById('city-type').value 
    };
    const terrain = document.getElementById('terrain-type').value;

    const results = resolveBattle(currentSFChain, target, terrain);
    renderConclusion(results);
}

function renderConclusion(results) {
    const box = document.getElementById('battle-conclusion');
    box.innerHTML = `
        <div class="log-entry">Commander(s) Entered: ${currentSFChain.length}</div>
        <div class="log-entry">Injuries Sustained: ${results.injuries || 0}</div>
        <div class="log-entry">Deaths Sustained: ${results.deaths || 0}</div>
        <div class="log-entry">Captures: ${results.captures || 0}</div>
        <div class="log-entry">Gold Acquired: +${results.gold || 0}g</div>
        <div class="log-entry highlight">Promotion: ${results.newRank || "Ready for Next Ticks"}</div>
        <div class="log-entry xp">XP Gained: +${results.xp || 0}</div>
    `;
}

function clearSFChain() {
    currentSFChain = [];
    renderSFUI();
}

function renderSFUI() {
    const list = document.getElementById('sf-list');
    list.innerHTML = currentSFChain.length ? "" : "<li>Ready...</li>";
    currentSFChain.forEach(c => {
        const li = document.createElement('li');
        li.textContent = `C${c.commanderId}: ${c.army[0].qty}x ${c.army[0].name}`;
        list.appendChild(li);
    });
}

function updateHUD() {
    // 1. XP Bar Calculation
    const xpNeeded = xpRequirements[player.rank];
    const xpPercent = (player.xp / xpNeeded) * 100;
    document.getElementById('hud-xp-fill').style.width = xpPercent + "%";

    // 2. Provisions Bar Calculation
    const currentProv = calculateCurrentArmyWeight(); // Sum of all units
    const maxProv = groundRanks[player.rank].max_slots;
    const provPercent = (currentProv / maxProv) * 100;
    document.getElementById('hud-prov-fill').style.width = provPercent + "%";

    // 3. Unit Circle (Healthy / Total)
    const healthy = calculateTotalHealthy();
    const total = calculateTotalUnits();
    document.getElementById('hud-unit-ratio').textContent = `${healthy}/${total}`;
}

// Opens the modal when Register is clicked
function handleRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'flex';
}

// Closes the modal
function closeRegister() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'none';
}

// Submits data to server
async function submitRegistration() {
    const user = document.getElementById('reg-username').value;
    const pass = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-password-confirm').value;
    const email = document.getElementById('reg-email').value;

   if (!user || !pass || !confirmPass) {
        alert("Commander, all required fields (*) must be forged!");
        return;
    }

    if (pass !== confirmPass) {
        alert("The passwords do not match, Commander! Re-check your secret phrase.");
        return; // This stops the code from reaching the "fetch" below
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass, email: email })
        });
        const data = await response.json();
        alert(data.msg);
        if (response.ok) closeRegister();
    } catch (err) {
        alert("The kingdom's record-keeper is busy. Try again soon!");
    }

}function enterGame() {
    const landing = document.getElementById('page-landing');
    const audio = document.getElementById('main-theme');
    
    landing.style.transition = "opacity 2s";
    landing.style.opacity = "0";
    
    setTimeout(() => {
        landing.style.display = "none";
        if (audio) audio.pause();
        updateHUD(); // Refresh the HUD with loaded player data
    }, 2000);
}

// Start music on first click (Browser policy requires user interaction)
document.addEventListener('click', () => {
    const audio = document.getElementById('main-theme');
    if (audio.paused) audio.play();
}, { once: true });

// Base64 SVGs for Muted and Unmuted states
const ICON_MUTED = `data:image/svg+xml;utf8,<svg xmlns='http://w3.org' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M11 5L6 9H2v6h4l5 4V5z'></path><line x1='18' y1='9' x2='22' y2='13'></line><line x1='22' y1='9' x2='18' y2='13'></line></svg>`;
const ICON_UNMUTED = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTExIDVMNiA5SDJ2Nmg0bDUgNFY1eiI+PC9wYXRoPjxwYXRoIGQ9Ik0xOS4wNyA0LjkzYTEwIDEwIDAgMCAxIDAgMTQuMTRNMTUuNTQgOC40NmE1IDUgMCAwIDEgMCA3LjA3Ij48L3BhdGg+PC9zdmc+";

function toggleMute() {
    const audio = document.getElementById('main-theme');
    const icon = document.getElementById('audio-icon');

    if (!audio || !icon) return;

    audio.muted = !audio.muted;

    if (audio.muted) {
        icon.className = 'icon-muted';
    } else {
        icon.className = 'icon-unmuted';
        audio.play().catch(e => console.log("Interaction required to unmute."));
    }
}

// Global "Unlock" on first interaction (ensures muted autoplay works)
window.addEventListener('click', () => {
    const audio = document.getElementById('main-theme');
    if (audio && audio.paused) audio.play();
}, { once: true });

function handleLogout() {
    const landing = document.getElementById('page-landing');
    const audio = document.getElementById('main-theme');

    if (landing) {
        // 1. Make the landing page visible again
        landing.style.display = "flex";
        
        // 2. Fade it in smoothly
        setTimeout(() => {
            landing.style.transition = "opacity 1.5s ease";
            landing.style.opacity = "1";
        }, 10);

        // 3. Reset and play the music from the beginning
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log("Audio waiting for user interaction..."));
        }
    }
}

let selectedClassId = null;

async function handleLogin() {
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });
        const data = await response.json();

        if (response.ok) {
            // 1. Immediately hide the landing page elements
            document.querySelector('.login-form-container').style.display = 'none';
            document.querySelector('.logo-wrapper').style.display = 'none';
            document.getElementById('auth-buttons').style.display = 'none';
            
            // 2. Trigger the narrative AND the cinematic instantly
            // This ensures the browser respects the 'Login' click as the trigger
            playTutorialNarrative();
            startClassSelectionSequence();

        } else {
            alert(data.msg);
        }
    } catch (err) {
        alert("The kingdom's gatekeepers are unreachable.");
    }
}

function startClassSelectionSequence() {
    const landing = document.getElementById('page-landing');
    const classScreen = document.getElementById('class-selection-screen');
    const classBg = document.querySelector('.class-bg');

    // 1. HIDE Landing, SHOW Class Screen
    landing.style.display = 'none';
    classScreen.style.display = 'block';
    classScreen.style.opacity = '1';

    if (classBg) {
        classBg.style.display = 'block';
        classBg.style.opacity = '1';
    }

    // 2. SHOW Navigation Bar (MOVED HERE)
    const nav = document.querySelector('.top-nav');
    if (nav) {
        nav.style.setProperty('display', 'flex', 'important');
        document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
            btn.style.display = btn.classList.contains('login-out') ? 'block' : 'none';
        });
    }

    // 3. START Narrative (MOVED HERE)
    playTutorialNarrative();

    // 4. REVEAL Statues (MOVED HERE)
    setTimeout(() => revealCard('card-battlemaster'), 500);
    setTimeout(() => revealCard('card-archmage'), 1200);
}

/* --- NARRATIVE SYSTEM DATA --- */
const dialogueLines = [
    "Welcome, traveler, to the Royal Armies.",
    "You have ventured far and seen much, I can tell... and most likely, you seek to finally settle your weary bones and find rest.",
    "But your legend is not yet written to its end. Across the horizon, the banners of desperate nations flutter in the wind, crying out for a savior.",
    "I ask you... indulge an old man’s final wish. Aid these people.",
    "They require a soul of iron and nobility—one who will not flinch when the frontlines bleed.",
    "Yet, before you take your rightful place among the Great Hosts of your nation, I must ask... what is your title?"
];

const dialogueAudio = [
    "audio/tutorial_oldman1.wav",
    "audio/tutorial_oldman2.wav",
    "audio/tutorial_oldman3.wav",
    "audio/tutorial_oldman4.wav",
    "audio/tutorial_oldman5.wav",
    "audio/tutorial_oldman6.wav"
];

let currentLineIndex = 0;
const voicePlayer = new Audio();

/* --- NARRATIVE ENGINE --- */
function playTutorialNarrative() {
    if (localStorage.getItem('royalArmies_tutorialSeen')) return;

    voicePlayer.play().then(() => {
        voicePlayer.pause();
        voicePlayer.currentTime = 0;
    }).catch(e => console.log("Waiting for user gesture..."));

    const box = document.getElementById('narrative-box');
    box.style.display = 'flex'; // ADD THIS LINE
    box.style.opacity = "1";
    
    currentLineIndex = 0;
    runCinematicStep();
    localStorage.setItem('royalArmies_tutorialSeen', 'true');
}

function runCinematicStep() {
    const textElement = document.getElementById('narrative-text');
    
    // Update Text
    textElement.innerText = dialogueLines[currentLineIndex];

    // Load and Play Audio
    voicePlayer.src = dialogueAudio[currentLineIndex];
    voicePlayer.play().catch(e => console.log("Audio waiting for interaction..."));

    // AUTO-ADVANCE LOGIC
    voicePlayer.onended = () => {
        currentLineIndex++;
        if (currentLineIndex < dialogueLines.length) {
            setTimeout(runCinematicStep, 800); // Dramatic pause
        } else {
            // Fade out when finished
            const box = document.getElementById('narrative-box');
            box.style.transition = "opacity 1.5s ease";
            box.style.opacity = "0";
            setTimeout(() => box.style.display = 'none', 1500);
        }
    };
}

    // 3. Show the Navigation Bar Logo & Logout
    const nav = document.querySelector('.top-nav');
    nav.style.setProperty('display', 'flex', 'important');
    
    document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
        btn.style.display = btn.classList.contains('login-out') ? 'block' : 'none';
    });

playTutorialNarrative(); 

    // 4. Reveal the giant statues
    setTimeout(() => revealCard('card-battlemaster'), 500);
    setTimeout(() => revealCard('card-archmage'), 1200);
}

function selectClass(className) {
    selectedClassId = className;

    // 1. Reset Classes and Panels
    document.querySelectorAll('.class-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.side-info-panel').forEach(panel => panel.classList.remove('show'));

    // 2. Define our image elements
    const bmImg = document.getElementById('img-battlemaster');
    const amImg = document.getElementById('img-archmage');

    // 3. Perform the Swap
    if (className === 'battlemaster') {
        // Wake up Battlemaster
        bmImg.src = 'images/battlemasterclass.png';
        // Turn Archmage to Stone
        amImg.src = 'images/classarchmagestone.png';
    } else {
        // Wake up Archmage
        amImg.src = 'images/classarchmage.png';
        // Turn Battlemaster to Stone
        bmImg.src = 'images/classbattlemasterstone.png';
    }

    // 4. Show the new visuals
    document.getElementById(`card-${className}`).classList.add('selected');
    document.getElementById(`info-${className}`).classList.add('show');
    document.getElementById('btn-confirm-class').disabled = false;
}

function confirmSelection() {
    // 1. Instantly hide the selection UI
    document.querySelectorAll('.side-info-panel').forEach(panel => {
        panel.classList.remove('show');
    });
    
    // Hide the whole selection screen
    const selectionScreen = document.getElementById('class-selection-screen');
    selectionScreen.style.transition = "opacity 0.8s ease";
    selectionScreen.style.opacity = "0";

    // 2. Trigger the game entry immediately
    setTimeout(() => {
        selectionScreen.style.display = 'none';
        enterMainGame();
    }, 800); // Wait for the fade-out to finish
}

function enterMainGame() {
    const gameContainer = document.getElementById('game-container');
    const selectionScreen = document.getElementById('class-selection-screen');

    // 1. Prepare the game container (still invisible due to opacity: 0)
    gameContainer.style.setProperty('display', 'block', 'important');

    // 2. Reveal all navigation buttons
    document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
        btn.style.display = 'block';
        if (btn.classList.contains('login-out')) {
            btn.style.marginLeft = '0';
        }
    });

    // 3. Reveal the Top Nav and HUD (if they were hidden)
    document.querySelector('.top-nav').style.display = 'flex';
    document.getElementById('player-hud').style.display = 'block';

    // 4. Trigger the smooth fade-in
    setTimeout(() => {
        gameContainer.style.opacity = "1";
    }, 50);

    // 5. Finally, remove the selection screen from the background
    selectionScreen.style.display = 'none';
}

// THE FINAL FUNCTION AT THE VERY BOTTOM
function revealCard(id) {
    const card = document.getElementById(id);
    if (card) {
        // This links directly to your new CSS fade-in
        card.classList.add('reveal-statue'); 
    }
}
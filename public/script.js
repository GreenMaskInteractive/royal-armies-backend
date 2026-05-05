/**
* script.js - THE LAST KNIGHTS
* Master UI & Simulation Controller
*/

// --- 1. DATA SAFETY NETS (Unlocks the script if server is offline) ---
if (typeof groundRanks === 'undefined') {
    var groundRanks = {
        "1": { title: "Recruit", max_slots: 100 },
        "2": { title: "Soldier", max_slots: 200 }
    };
}
if (typeof unitDatabase === 'undefined') {
    var unitDatabase = { "INFANTRY": {} };
}

// --- 2. GLOBAL STATE ---
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

// --- 3. VERIFICATION ENGINE ---
const eventSource = new EventSource('/listen-for-verify');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.verified) {
        alert("Thank you for joining in the war effort! Your nation awaits you!");
    }
};

// --- 4. INITIALIZATION ---
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
    const unitCat = document.getElementById('unit-category');
    if(unitCat) unitCat.addEventListener('change', updateUnitDropdown);
    
    const unitSel = document.getElementById('unit-select');
    if(unitSel) unitSel.addEventListener('change', updateRankDropdown);
    
    const btnMax = document.getElementById('btn-max');
    if(btnMax) btnMax.addEventListener('click', handleMaxClick);
    
    const btnAddSf = document.getElementById('btn-add-sf');
    if(btnAddSf) btnAddSf.addEventListener('click', addCommanderToChain);
    
    const btnClearSf = document.getElementById('btn-clear-sf');
    if(btnClearSf) btnClearSf.addEventListener('click', clearSFChain);

    const battleBtn = document.getElementById('btn-hold-battle');
    if (battleBtn) {
        battleBtn.onclick = runUnifiedAssault;
        battleBtn.onmousedown = startHoldTimer;
        battleBtn.onmouseup = stopHoldTimer;
        battleBtn.onmouseleave = stopHoldTimer;
        battleBtn.ontouchstart = startHoldTimer;
        battleBtn.ontouchend = stopHoldTimer;
    }
}

// --- 5. AUTHENTICATION & LOGIN ---
async function handleLogin() {
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;

    // SKELETON KEY / BYPASS
    if (userVal === "OVERRIDE" || userVal === "DEV") {
        startClassSelectionSequence();
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });
        
        if (response.ok) {
            document.querySelector('.login-form-container').style.display = 'none';
            document.querySelector('.logo-wrapper').style.display = 'none';
            document.getElementById('auth-buttons').style.display = 'none';
            startClassSelectionSequence();
        } else {
            const data = await response.json();
            alert(data.msg);
        }
    } catch (err) {
        console.warn("Gatekeepers unreachable, forcing entrance...");
        startClassSelectionSequence();
    }
}

// --- 6. CLASS SELECTION SEQUENCE ---
function startClassSelectionSequence() {
    const landing = document.getElementById('page-landing');
    const classScreen = document.getElementById('class-selection-screen');
    const classBg = document.querySelector('.class-bg');

    // 1. Switch Screen
    landing.style.display = 'none';
    classScreen.style.display = 'block';
    classScreen.style.opacity = '1';

    if (classBg) {
        classBg.style.display = 'block';
        classBg.style.opacity = '1';
    }

    // 2. Show Navigation Bar
    const nav = document.querySelector('.top-nav');
    if (nav) {
        nav.style.setProperty('display', 'flex', 'important');
        document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
            btn.style.display = btn.classList.contains('login-out') ? 'block' : 'none';
        });
    }

    const bmImg = document.getElementById('img-battlemaster');
    if (bmImg) bmImg.classList.add('stone-form');

    // 3. Trigger Narrative & Statues
    playTutorialNarrative();
    setTimeout(() => revealCard('card-battlemaster'), 500);
    setTimeout(() => revealCard('card-archmage'), 1200);
}

function selectClass(className) {
    
if (!narrativeFinished) {
        console.log("Patience, traveler. The Old Man is speaking.");
        return; // This stops the function from running
    }
    
    const bmImg = document.getElementById('img-battlemaster');
    if (bmImg) {
        bmImg.classList.remove('stone-form');
    }

selectedClassId = className;
    document.querySelectorAll('.class-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.side-info-panel').forEach(panel => panel.classList.remove('show'));

    const bmImg = document.getElementById('img-battlemaster');
    const amImg = document.getElementById('img-archmage');

    if (className === 'battlemaster') {
        bmImg.src = 'images/battlemasterclass.png';
        amImg.src = 'images/classarchmagestone.png';
    } else {
        amImg.src = 'images/classarchmage.png';
        bmImg.src = 'images/classbattlemasterstone.png';
    }

    document.getElementById(`card-${className}`).classList.add('selected');
    document.getElementById(`info-${className}`).classList.add('show');
}

function confirmSelection() {
    document.querySelectorAll('.side-info-panel').forEach(panel => panel.classList.remove('show'));
    const selectionScreen = document.getElementById('class-selection-screen');
    selectionScreen.style.transition = "opacity 0.8s ease";
    selectionScreen.style.opacity = "0";

    setTimeout(() => {
        selectionScreen.style.display = 'none';
        enterMainGame();
    }, 800);
}

// --- 7. NARRATIVE ENGINE ---
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

function playTutorialNarrative() {
    // If they've seen it before, unlock immediately
    if (localStorage.getItem('royalArmies_tutorialSeen')) {
        narrativeFinished = true; 
        return;
    }

    narrativeFinished = false; // Lock it for new players
    const box = document.getElementById('narrative-box');
    if (box) {
        box.style.display = 'flex';
        box.style.opacity = "1";
    }
    
    currentLineIndex = 0;
    runCinematicStep();
    localStorage.setItem('royalArmies_tutorialSeen', 'true');
}

function runCinematicStep() {
    const textElement = document.getElementById('narrative-text');
    if (!textElement) return;

    textElement.innerText = dialogueLines[currentLineIndex];
    voicePlayer.src = dialogueAudio[currentLineIndex];
    voicePlayer.play().catch(e => console.log("Audio waiting..."));

       voicePlayer.onended = () => {
        currentLineIndex++;
        if (currentLineIndex < dialogueLines.length) {
            setTimeout(runCinematicStep, 800); 
        } else {
            narrativeFinished = true; // UNLOCK the statues here!
            const box = document.getElementById('narrative-box');
            // ... (rest of your fade out code)
        }
    };
}

// --- 8. GAME SYSTEMS & HUD ---
function enterMainGame() {
    const gameContainer = document.getElementById('game-container');
    const selectionScreen = document.getElementById('class-selection-screen');

    gameContainer.style.setProperty('display', 'block', 'important');

    document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
        btn.style.display = 'block';
        if (btn.classList.contains('login-out')) btn.style.marginLeft = '0';
    });

    document.querySelector('.top-nav').style.display = 'flex';
    const hud = document.getElementById('player-hud');
    if(hud) hud.style.display = 'block';

    setTimeout(() => {
        gameContainer.style.opacity = "1";
    }, 50);

    selectionScreen.style.display = 'none';
}

function revealCard(id) {
    const card = document.getElementById(id);
    if (card) {
        card.style.opacity = "1";
        card.classList.add('reveal-statue');
    }
}

// --- 9. UTILITIES (Existing Battle & Logic) ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
}

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
    if(!unitSelect) return;
    unitSelect.innerHTML = "";
    if(!unitDatabase[cat]) return;
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
    if(!rankSelect) return;
    rankSelect.innerHTML = "";
    const unit = unitDatabase[cat][unitName];
    if(!unit) return;
    Object.keys(unit.stats).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r.toUpperCase();
        rankSelect.appendChild(opt);
    });
}

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

function renderSFUI() {
    const list = document.getElementById('sf-list');
    if(!list) return;
    list.innerHTML = currentSFChain.length ? "" : "<li>Ready...</li>";
    currentSFChain.forEach(c => {
        const li = document.createElement('li');
        li.textContent = `C${c.commanderId}: ${c.army[0].qty}x ${c.army[0].name}`;
        list.appendChild(li);
    });
}

function clearSFChain() {
    currentSFChain = [];
    renderSFUI();
}

function runUnifiedAssault() {
    if (currentSFChain.length === 0) {
        stopHoldTimer();
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

function startHoldTimer(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    const progressBar = document.getElementById('hold-progress-bar');
    if (progressBar) progressBar.style.width = "100%";
    holdTimer = setTimeout(function() {
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
        setTimeout(() => { progressBar.style.transition = "width 1s linear"; }, 50);
    }
    clearTimeout(holdTimer);
    clearInterval(battleHoldInterval);
    holdTimer = null;
    battleHoldInterval = null;
}

function handleLogout() {
    const landing = document.getElementById('page-landing');
    if (landing) {
        landing.style.display = "flex";
        setTimeout(() => {
            landing.style.transition = "opacity 1.5s ease";
            landing.style.opacity = "1";
        }, 10);
    }
}

window.handleLogin = handleLogin;
window.confirmSelection = confirmSelection;
window.selectClass = selectClass;
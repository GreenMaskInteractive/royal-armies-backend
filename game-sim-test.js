// game-sim-test.js
const readline = require('readline-sync'); // You'll need to install this: npm install readline-sync
const { generateRankedSimulation } = require('./training-sim');
const { resolveBattle } = require('./battle-engine');
const { unitDatabase } = require('./unit-data');
const { groundRanks } = require('./rank-data');

// --- INITIAL STATE ---
let player = {
    username: "Test_Commander",
    rank: 1,
    gold: 5000,
    used_slots: 0,
    max_slots: 120, // Starting Authority
    army: [],
    xp: 0
};

function gameLoop() {
    console.log(`\n=== COMMANDER DASHBOARD [Rank ${player.rank}: ${player.username}] ===`);
    console.log(`Gold: ${player.gold} | Slots: ${player.used_slots}/${player.max_slots} | XP: ${player.xp}`);
    
    let action = readline.question("\nActions: [1] Barracks [2] Training Run [3] Heal Army [4] Exit\n> ");

    if (action === "1") openBarracks();
    else if (action === "2") startTraining();
    else if (action === "4") process.exit();
    
    gameLoop();
}

function openBarracks() {
    console.log("\n--- BARRACKS ---");
    // Show Tier 1 units
    const units = ["Recruit Shieldman", "Squire Rider", "Levy Archer", "Wild Wolf"];
    units.forEach((u, i) => {
        console.log(`[${i+1}] ${u} (9 Slots, 50 Gold)`);
    });
    
    let choice = readline.question("Buy which unit? (or 'b' to go back): ");
    if (choice !== 'b') {
        let qty = parseInt(readline.question("How many?: "));
        // Logic: Subtract gold, add to army, update used_slots
        console.log(`Bought ${qty} units!`);
    }
}

function startTraining() {
    const npc = generateRankedSimulation(player.rank);
    console.log(`\nEncounter: ${npc.opponentName}`);
    
    const result = resolveBattle(player, npc);
    console.log(result.battle_log.join("\n"));
    
    // XP & Ranking Logic
    player.xp += 50; 
    if (player.xp >= 100) {
        player.rank++;
        player.xp = 0;
        player.max_slots = groundRanks[player.rank].max_slots;
        console.log(`\n*** PROMOTED TO ${groundRanks[player.rank].title}! ***`);
        console.log(`Your Commission Bar has expanded to ${player.max_slots} slots.`);
    }
}

gameLoop();
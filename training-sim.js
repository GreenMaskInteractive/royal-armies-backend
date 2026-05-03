// training-sim.js
const { unitDatabase } = require('./unit-data');

/**
 * Generates an NPC army with a random mixture of 2 to 4 unit classes.
 * Difficulty scales smoothly from Rank 1 (5% HP / 1% Str) to Rank 22 (70% HP / 75% Str).
 */
function generateRankedSimulation(playerRank) {
    // 1. DYNAMIC SCALING MATH
    // HP: Starts at 5%. Grows ~3% per rank.
    // Str: Starts at 1%. Grows ~3.5% per rank to ensure Rank 1 is "safe".
    const hpScale = 0.20 + ((playerRank - 1) * 0.238); 
    const strScale = 0.40 + ((playerRank - 1) * 0.166);

    // 2. CLASS SELECTION (2, 3, or 4 random classes)
    const classCount = Math.floor(Math.random() * 3) + 2; 
    const balanceMult = 4.0 / classCount; 
    
    const possibleClasses = ["INFANTRY", "CAVALRY", "ARTILLERY", "BEASTS"];
    const selectedClasses = possibleClasses
        .sort(() => 0.5 - Math.random())
        .slice(0, classCount);

    // 3. DEFINE QUANTITY RANGES (Lightened for smoother early-game grind)
    const bonuses = { "INFANTRY": 2, "CAVALRY": 1, "ARTILLERY": 1, "BEASTS": 2 };
    const baseRanges = {
        "INFANTRY": { min: 5, max: 10 },
        "CAVALRY":  { min: 2, max: 5 },
        "ARTILLERY": { min: 2, max: 5 },
        "BEASTS":    { min: 4, max: 8 }
    };

    // 4. GENERATE THE ARMY
    const npcArmy = selectedClasses.map(type => {
        const unitKey = { 
            "INFANTRY": "Recruit Shieldman", 
            "CAVALRY": "Squire Rider", 
            "ARTILLERY": "Levy Archer", 
            "BEASTS": "Wild Wolf" 
        }[type];
        
        const baseStats = unitDatabase[type][unitKey];
        
        // Calculate Quantity for this specific run
        const range = baseRanges[type];
        const rankMod = (playerRank - 1) * bonuses[type];
        const baseQty = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min + rankMod;
        const finalQty = Math.floor(baseQty * balanceMult);

        return {
            type: baseStats.type || type,
            name: `Training ${unitKey}`,
            qty: finalQty,
            // Apply the RISING scaling factors
            // Math.floor(11 * 0.01) = 0 Strength at Rank 1
            hp: Math.max(1, Math.floor(baseStats.hp.std * hpScale)),
            str: Math.max(0, Math.floor(baseStats.str.std * strScale)),
            slots: baseStats.slots
        };
    });

    return {
        opponentName: `Rank ${playerRank} (${classCount}-Class Mix) Evaluation`,
        ruleset: "TRAINING",
        scalingDetails: { 
            hp_percent: Math.round(hpScale * 100) + "%", 
            str_percent: Math.round(strScale * 100) + "%" 
        },
        army: npcArmy
    };
}

module.exports = { generateRankedSimulation };
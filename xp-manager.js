// xp-manager.js

function calculateBattleXP(battleResult, isTraining) {
    // 1. BASE XP (The "Show Up" Fee)
    let totalXP = 50; 

    // 2. BATTLE DURATION XP (The "LastKnights" Logic)
    // Longer battles = More tactical experience gained
    // Each round of "The Grind" adds significant XP
    const grindRounds = battleResult.rounds_fought || 0;
    totalXP += (grindRounds * 15); 

    // 3. PHASE PARTICIPATION BONUSES
    // Did the battle go long enough for these phases to happen?
    if (battleResult.reached_phase_3) totalXP += 20; // Cavalry Charge happened
    if (battleResult.reached_phase_4) totalXP += 40; // Melee Grind happened

    // 4. THE RANDOM VARIANCE (Volatility)
    // Multiplies final XP by 0.85 to 1.15 (±15% variance)
    const volatility = 0.85 + (Math.random() * 0.30);
    totalXP = Math.floor(totalXP * volatility);

    // 5. TRAINING SIM CAP (The "Gap" Logic)
    if (isTraining) {
        // Training is capped to prevent AFK farming to Rank 22
        // SFs (Real Battles) get the full amount + bonuses
        totalXP = Math.min(totalXP, 300); 
    }

    return totalXP;
}

module.exports = { calculateBattleXP };
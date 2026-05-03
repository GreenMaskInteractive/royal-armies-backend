// gold-manager.js

function calculateCaptureLoot(battleResult, playerArmy, isTraining) {
    let totalCaptures = 0;
    let goldReward = 0;

    // 1. BASE CAPTURE RATE
    // Training has a lower base rate than PvP
    const baseCaptureRate = isTraining ? 0.05 : 0.15; // 5% vs 15%

    // 2. THE CAVALRY BONUS
    // Check if the player has Cavalry in their surviving army
    const hasCavalry = playerArmy.some(u => u.type === "PHYS_CAV" || u.type === "MAG_CAV");
    
    // Cavalry increases the capture rate by an additional 10%
    const finalCaptureRate = hasCavalry ? (baseCaptureRate + 0.10) : baseCaptureRate;

    // 3. CALCULATE REWARD
    // We look at how many NPC units were defeated
    const defeatedNPCs = battleResult.npc_casualties; 
    totalCaptures = Math.floor(defeatedNPCs * finalCaptureRate);

    // 4. PAYOUT (Small for training, as requested)
    // Training units have a tiny reclaim value (e.g., 2-5 gold each)
    goldReward = totalCaptures * (isTraining ? 3 : 25); 

    return {
        captures: totalCaptures,
        gold: goldReward,
        cavalryBonusApplied: hasCavalry
    };
}
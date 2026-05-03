// loot-engine.js

/**
 * Calculates individual gold rewards for an SF group.
 * @param {Array} playerArmies - List of all commanders in the SF
 * @param {number} totalNPCCasualties - Total enemies defeated
 * @param {boolean} isTraining - Is this a sim or a real SF?
 */
function distributeSFLoot(playerArmies, totalNPCCasualties, isTraining) {
    let distribution = [];

    // 1. Calculate the 'Capture Pool' (e.g., 10% of defeated enemies)
    const baseCaptureRate = 0.10;
    const totalCapturesAvailable = Math.floor(totalNPCCasualties * baseCaptureRate);

    // 2. Individual Contribution Check
    // We determine each player's 'Capture Power' based on their unit types
    let totalGroupCapturePower = 0;
    playerArmies.forEach(player => {
        player.capturePower = 0;
        player.army.forEach(unit => {
            // Cavalry has 3x the capture power of other units
            const multiplier = (unit.type === "PHYS_CAV" || unit.type === "MAG_CAV") ? 3 : 1;
            player.capturePower += (unit.quantity * multiplier);
        });
        totalGroupCapturePower += player.capturePower;
    });

    // 3. Payout based on OWN involvement
    playerArmies.forEach(player => {
        // Percentage of the group's capture effort
        const contributionRatio = player.capturePower / totalGroupCapturePower;
        const individualCaptures = Math.floor(totalCapturesAvailable * contributionRatio);
        
        // Payout per capture (SFs pay more than NPC Training)
        const payoutPerUnit = isTraining ? 3 : 25; 
        const totalGold = individualCaptures * payoutPerUnit;

        distribution.push({
            username: player.username,
            captures: individualCaptures,
            goldEarned: totalGold
        });
    });

    return distribution;
}
// tick-manager.js
const { militaryLogistics } = require('./game-mechanics');

/**
 * Main Tick Function
 * This will eventually run every 30 minutes.
 */
function processTick(playerData) {
    let totalPayroll = 0;
    let totalIncome = calculateIncome(playerData.cities);

    // 1. Calculate the 'Gold Drain' from the army
    playerData.army.forEach(unit => {
        const wage = militaryLogistics.wage_per_tier[unit.tier];
        totalPayroll += (wage * unit.quantity);
    });

    // 2. Update Treasury
    playerData.gold += (totalIncome - totalPayroll);

    // 3. Bankruptcy Check
    if (playerData.gold < 0) {
        playerData.status = "BANKRUPT";
    }

    return playerData;
}

function calculateIncome(cities) {
    // Placeholder logic for gold from cities
    return cities.length * 100; 
}

module.exports = { processTick };
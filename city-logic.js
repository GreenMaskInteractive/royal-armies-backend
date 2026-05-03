// city-logic.js

const ageBudgetScale = {
    "VILLAGE": 500,
    "TOWN": 1500,
    "CITY": 4000,
    "CAPITAL": 10000
};

/**
 * Calculates the total possible budget for a city based on the day.
 */
function getTotalBudgetForDay(cityType, ageDay) {
    const base = ageBudgetScale[cityType];
    const dayMultiplier = 1 + (ageDay * 0.20); 
    return Math.floor(base * dayMultiplier);
}

/**
 * Update an OWNED city to reflect the new day's budget increase.
 * It only adds the difference, not the whole amount.
 */
function updateOwnedCityBudget(city, ageDay) {
    const totalPossible = getTotalBudgetForDay(city.type, ageDay);
    const lastPossible = getTotalBudgetForDay(city.type, ageDay - 1);
    
    // Add only the daily increase (the difference)
    const dailyIncrease = totalPossible - lastPossible;
    city.vault_balance += dailyIncrease;
}

/**
 * Handles the 30-minute dismantle process.
 */
function initiateDismantle(city, upgradeType) {
    // 1. Mark city as "Under Construction"
    city.is_dismantling = true;
    city.dismantle_target = upgradeType;
    
    // 2. The frontend/backend will wait 30 minutes (one tick) 
    // before calling the completion function.
}

function completeDismantle(city) {
    const upgrade = city.upgrades.find(u => u.type === city.dismantle_target);
    
    // Return the gold to the city vault
    city.vault_balance += upgrade.cost;
    
    // Remove the upgrade and clear status
    city.upgrades = city.upgrades.filter(u => u.type !== city.dismantle_target);
    city.is_dismantling = false;
}

module.exports = { 
    getTotalBudgetForDay, 
    updateOwnedCityBudget, 
    handleCityCapture, // (from previous turn)
    initiateDismantle,
    completeDismantle 
};
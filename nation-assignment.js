// nation-assignment.js

/**
 * Logic to find the countries with the fewest players 
 * and randomly assign the new player to one of them.
 */
function getBalancedNation(nationStats) {
    // 1. Find the lowest number of players any nation has
    const minPlayers = Math.min(...Object.values(nationStats));

    // 2. Filter nations that are at that minimum (or within a small margin, like +1)
    const candidates = Object.keys(nationStats).filter(name => {
        return nationStats[name] <= minPlayers + 1; 
    });

    // 3. Roll the die between the emptiest candidates
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
}

module.exports = { getBalancedNation };
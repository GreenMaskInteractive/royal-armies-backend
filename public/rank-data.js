/**
 * rank-data.js 
 * THE LAST KNIGHTS - Universal Rank Database
 */

// 1. XP TABLE (Requirements to reach the NEXT rank)
var xpRequirements = {
    1: 90, 2: 130, 3: 190, 4: 270, 5: 380, 
    6: 550, 7: 790, 8: 1120, 9: 1600, 10: 2240, 
    11: 3110, 12: 4350, 13: 5960, 14: 8100, 15: 11020, 
    16: 14880, 17: 20240, 18: 27120, 19: 36070, 20: 47970, 
    21: 80000, 22: 0 
};

// 2. AUTHORITY (PROVISION) SCALING LOGIC (250p -> 10,000p)
var calculateAuthority = function(rank) {
    var authorityTable = {
        1: 250,   2: 500,   3: 750,   4: 1000,  5: 1300, 
        6: 1650,  7: 2000,  8: 2400,  9: 2850,  10: 3300,
        11: 3800, 12: 4350, 13: 4900, 14: 5500, 15: 6150, 
        16: 6800, 17: 7500, 18: 8000, 19: 8500, 20: 9000, 
        21: 9500, 22: 10000
    };
    return authorityTable[rank] || 250;
};

// 3. TITLE ARRAYS
var groundTitles = [
    "Vintenary", "Decurion", "Warden", "Serjeant", "Provost", 
    "Centenary", "Herald", "Bachelor", "Banneret", "Castellan", 
    "Seneschal", "Constable", "Millenary", "Baronial", "Comital", 
    "Marcher", "Palatine", "Marshal", "Duchal", "Viceroy", 
    "Grand-Magister", "Lord-High"
];

var magicTitles = [
    "Initiate", "Apprentice", "Acolyte", "Evoker", "Channeler", 
    "Circle", "Signifier", "Scholastic", "Weaver", "Warden", 
    "Preceptor", "High Magus", "Grand Magus", "Arcanist", "Archmagus", 
    "Sorcerer-General", "Coven-Lord", "Master of Spheres", "Nexus-Thane", 
    "Void-Exarch", "Hierophant", "Aether-Sovereign"
];

// 4. GENERATOR FUNCTION
var generateRanks = function(titles) {
    var ranks = {};
    titles.forEach(function(title, index) {
        var rankNum = index + 1;
        ranks[rankNum] = {
            title: title,
            max_slots: calculateAuthority(rankNum),
            xp_needed: xpRequirements[rankNum] || 0
        };
    });
    return ranks;
};

// 5. GLOBAL INITIALIZATION (Visible to script.js)
var groundRanks = generateRanks(groundTitles);
var magicRanks = generateRanks(magicTitles);

console.log("rank-data.js: 22 Ranks initialized.");
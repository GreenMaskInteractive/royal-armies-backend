/**
 * rank-data.js 
 * THE LAST KNIGHTS - Universal Rank Database
 */

var CHRONICLE_MAX_RANK = 50;

// 1. XP TABLE (Requirements to reach the NEXT rank)
var xpRequirements = {
    1: 90, 2: 130, 3: 190, 4: 270, 5: 380,
    6: 550, 7: 790, 8: 1120, 9: 1600, 10: 2240,
    11: 3110, 12: 4350, 13: 5960, 14: 8100, 15: 11020,
    16: 14880, 17: 20240, 18: 27120, 19: 36070, 20: 47970,
    21: 80000, 22: 105000
};

(function hydrateChronicleXpRequirementsThroughRank50() {
    var growthBase = xpRequirements[21];
    var growthRate = 1.072;
    for (var rank = 23; rank <= 49; rank++) {
        xpRequirements[rank] = Math.round(growthBase * Math.pow(growthRate, rank - 21));
    }
    xpRequirements[50] = 0;
})();

// 2. AUTHORITY (PROVISION) SCALING LOGIC (250p -> 12,000p at rank 50)
var calculateAuthority = function(rank) {
    var authorityTable = {
        1: 250,   2: 500,   3: 750,   4: 1000,  5: 1300,
        6: 1650,  7: 2000,  8: 2400,  9: 2850,  10: 3300,
        11: 3800, 12: 4350, 13: 4900, 14: 5500, 15: 6150,
        16: 6800, 17: 7500, 18: 8000, 19: 8500, 20: 9000,
        21: 9500, 22: 10000
    };
    if (authorityTable[rank]) return authorityTable[rank];
    if (rank > 22 && rank <= CHRONICLE_MAX_RANK) {
        return Math.min(12000, Math.round(9500 + ((rank - 21) / (CHRONICLE_MAX_RANK - 21)) * (12000 - 9500)));
    }
    return 250;
};

// 3. TITLE ARRAYS (ranks 1–22: full Battlemaster Commander titles; 23+ Chronicle ladder)
var groundTitles = [
    "Vintenary Commander", "Decurion Commander", "Warden Commander", "Serjeant Commander", "Provost Commander",
    "Centenary Commander", "Herald Commander", "Bachelor Commander", "Banneret Commander", "Castellan Commander",
    "Seneschal Commander", "Constable Commander", "Millenary Commander", "Baronial Commander", "Comital Commander",
    "Marcher Commander", "Palatine Commander", "Marshal Commander", "Duchal Commander", "Viceroy Commander",
    "Sovereign Commander", "Lord-High Commander",
    "Legate", "Prefect", "Tribune", "Proconsul", "Primarch",
    "Exarch", "Crown-Warden", "War-Prince", "High Exarch", "Imperial Knight",
    "Grand Legate", "Sovereign Knight", "Marshal-Supreme", "Arch-Castellan", "Grand Constable",
    "Imperial Warden", "Crown Marshal", "High Sovereign", "Eternal Warden", "Grand Imperator",
    "Supreme Legate", "Crown Imperator", "Amnek's Champion", "War-Sovereign", "Grand Crown",
    "Supreme Lord", "Eternal Sovereign", "Agebringer"
];

var magicTitles = [
    "Initiate Magus", "Apprentice Magus", "Acolyte Magus", "Evoker Magus", "Channeler Magus",
    "Circle Magus", "Signifier Magus", "Scholastic Magus", "Weaver Magus", "Warden Magus",
    "Preceptor Magus", "High Magus", "Grand Magus", "Arcanist Magus", "Archmagus",
    "Sorcerer-General", "Coven-Lord", "Master of Spheres", "Nexus-Thane Magus",
    "Void-Exarch Magus", "Hierophant Magus", "Aether-Sovereign Magus",
    "Lumen Adept", "Spellwarden", "Arc-Light", "Mystic Vanguard", "Ether Knight",
    "Rune Praetor", "Void Legate", "Starweaver", "Astral Tribune", "Crown Channeler",
    "High Evoker", "Grand Signifier", "Nexus Warden", "Sphere Lord", "Arch Channeler",
    "Eclipse Magus", "Prime Hierophant", "Void Crown", "Aether Prince", "Ley Imperator",
    "Star Sovereign", "Rift Marshal", "Omnimancer", "Grand Hierophant", "Crown Aether",
    "Supreme Weaver", "Age-Archon", "Mythic Sovereign"
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

console.log("rank-data.js: " + CHRONICLE_MAX_RANK + " ranks initialized.");
// game-mechanics.js

// --- CITY GROWTH & DEFENSE ---
const cityStats = {
    village: { garrison_boost: 1.0, wall_slots: 1 },
    town:    { garrison_boost: 1.5, wall_slots: 2 },
    city:    { garrison_boost: 2.0, wall_slots: 4 },
    capital: { garrison_boost: 3.0, wall_slots: 6 }
};

// --- BUILDING EFFECTS ---
const buildings = {
    walls: { 
        name: "Fortified Walls", 
        defense_bonus: 0.25 // +25% defense per level
    },
    watchtower: { 
        name: "Watchtower", 
        los_range: 1, // Clears fog for bordering cities
        defense_bonus: 0 
    }
};

// --- COMMISSION & PAYROLL RULES ---
const militaryLogistics = {
    // COMMISSION: Logistical 'Weight' per unit tier
    weight_per_tier: { 
        1: 2, 2: 5, 3: 10, 4: 18, 5: 30, 6: 50, 7: 85 
    },
    // PAYROLL: Gold cost per unit per 30-minute tick
    wage_per_tier: { 
        1: 5, 2: 15, 3: 40, 4: 100, 5: 250, 6: 600, 7: 1500 
    }
};

// Update your exports to include the new logic
module.exports = { cityStats, buildings, militaryLogistics };

module.exports = { cityStats, buildings };
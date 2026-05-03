// battle-logic.js

const counterModifiers = {
    "PHYS_INF": { "PHYS_ART": 1.5, "MAG_CAV": 1.5 },
    "PHYS_CAV": { "PHYS_INF": 1.5, "MAG_ART": 1.5 },
    "PHYS_ART": { "PHYS_BST": 1.5, "MAG_INF": 1.5 },
    "PHYS_BST": { "PHYS_CAV": 1.5, "MAG_BST": 1.5 },
    "MAG_INF":  { "PHYS_CAV": 1.5, "MAG_ART": 1.5 },
    "MAG_CAV":  { "PHYS_BST": 1.5, "MAG_INF": 1.5 },
    "MAG_ART":  { "PHYS_INF": 1.5, "MAG_BST": 1.5 },
    "MAG_BST":  { "PHYS_ART": 1.5, "MAG_CAV": 1.5 }
};

function resolveBattle(sfChain, targetCity, terrain) {
    let log = ["Unified Strike Force Initiated..."];
    
    // 1. POOL AGGREGATION
    let pool = { hp: 0, melee: 0, ranged: 0, cav: 0, armyTypes: {} };
    
    sfChain.forEach(commander => {
        commander.army.forEach(stack => {
            const unit = unitDatabase[stack.class][stack.name];
            const stats = unit.stats[stack.rank];
            const qty = stack.qty;

            // Terrain Breakthrough Logic
            let hpMult = 1.0;
            let strMult = 1.0;
            if (unit.terrainBonus && (terrain === "Mountain" || terrain === "Snow")) {
                hpMult = unit.terrainBonus;
                strMult = unit.terrainBonus;
            }

            pool.hp += (stats.hp * hpMult * qty);
            
            // Distribute Dmg by Phase
            if (unit.type.includes("ART")) {
                pool.ranged += (stats.rng * strMult * qty);
                pool.melee += (stats.str || stats.m_str || 0) * strMult * qty;
            } else if (unit.type.includes("CAV")) {
                pool.cav += (stats.str * strMult * qty * 2); // Double-Strike
                pool.melee += (stats.str * strMult * qty);
            } else {
                pool.melee += (stats.str * strMult * qty);
            }

            pool.armyTypes[unit.type] = (pool.armyTypes[unit.type] || 0) + qty;
        });
    });

    let cityHP = targetCity.hp;
    let cityStr = targetCity.str;
    log.push(`Unified Pool Entry: ${pool.hp.toFixed(0)} HP | Target: ${cityHP} HP`);

    // 2. PHASE 1: RANGED VOLLEY
    if (pool.ranged > 0) {
        cityHP -= pool.ranged;
        log.push(`[PHASE 1] Ranged Volley: ${pool.ranged.toFixed(0)} damage dealt.`);
    }

    // 3. PHASE 2: CAVALRY CHARGE
    if (pool.cav > 0) {
        cityHP -= pool.cav;
        log.push(`[PHASE 2] Cavalry Charge: ${pool.cav.toFixed(0)} damage dealt.`);
    }

    // 4. PHASE 4: THE 8-ROUND GRIND
    let round = 1;
    const maxRounds = 8;
    while (round <= maxRounds && pool.hp > 0 && cityHP > 0) {
        // Simple Counter Check
        let modifier = 1.0;
        Object.keys(pool.armyTypes).forEach(type => {
            if (counterModifiers[type] && counterModifiers[type][targetCity.primaryType]) {
                modifier += 0.05; // 5% bonus per countering unit type in the pool
            }
        });

        const playerDmg = pool.melee * modifier;
        cityHP -= playerDmg;
        pool.hp -= cityStr;

        log.push(`Round ${round}: City HP: ${Math.max(0, cityHP.toFixed(0))} | Army HP: ${Math.max(0, pool.hp.toFixed(0))}`);
        
        if (cityHP <= 0) break;
        round++;
    }

    // 5. CONCLUSION
    const success = cityHP <= 0;
    log.push(success ? "--- SUCCESS: CITY CAPTURED ---" : "--- FAILURE: SF RETREATED ---");
    if (success && round <= 3) log.push("RESULT: CITY SHATTERED!");

    return {
        winner: success ? "Commanders" : "City",
        log: log,
        shattered: (success && round <= 3),
        roundsPlayed: round > 8 ? 8 : round
    };
}
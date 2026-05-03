// construction-logic.js

const upgradeRules = {
    holding_period_required: 24, // Hours
    requires_council_presence: true, 
};

function canUpgradeCity(city, commander) {
    // 1. Has the nation held the city for 24 hours?
    const hoursHeld = (Date.now() - city.capture_timestamp) / (1000 * 60 * 60);
    
    if (hoursHeld < upgradeRules.holding_period_required) {
        return { can_build: false, reason: "City held for less than 24 hours." };
    }

    // 2. Is a Council Member or Leader currently IN the city?
    if (commander.current_location !== city.id) {
        return { can_build: false, reason: "Authorized official must be present in city." };
    }

    // 3. Does the city have enough accumulated 'Upgrade Gold'?
    // (Logic from our previous step)
    
    return { can_build: true };
}
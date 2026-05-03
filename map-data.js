// map-data.js

const worldMap = {
    "Angel Hill": {
        terrain: "Forest",
        region: "NORTH", // Only appears in North Age
        connections: ["Grishoria's Bridge", "Glathorian Crossing"],
        starting_garrison: 500
    },
    "Serpent Rivers": {
        terrain: "Swamp",
        region: "BOTH", // THE OVERLAP - Appears in every Age
        connections: ["Grishoria's Heart", "Phantom Deep"],
        starting_garrison: 750
    },
    "Taruh's Cave": {
        terrain: "Mountains",
        region: "SOUTH", // Only appears in South Age
        connections: ["Southern Bay River"],
        starting_garrison: 500
    }
};

module.exports = { worldMap };
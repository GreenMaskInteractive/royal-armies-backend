// age-controller.js

const maps = {
    NORTH: "North Amnek",
    SOUTH: "South Amnek"
};

function getActiveMapForAge(ageNumber) {
    // If the age number is odd (1, 3, 5), use North. 
    // If it's even (2, 4, 6), use South.
    return ageNumber % 2 !== 0 ? maps.NORTH : maps.SOUTH;
}

module.exports = { getActiveMapForAge };
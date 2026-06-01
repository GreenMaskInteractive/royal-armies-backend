#!/usr/bin/env node
/**
 * One-off ledger patch: set a commander's ageProvisions in db.json.
 * Usage: node scripts/set-commander-provisions.js <username> <provisions>
 * Example: node scripts/set-commander-provisions.js caleb_admin 55
 */
'use strict';

const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'db.json');
const username = String(process.argv[2] || '').trim();
const nextProvisions = Math.floor(Number(process.argv[3]));

if (!username) {
    console.error('Usage: node scripts/set-commander-provisions.js <username> <provisions>');
    process.exit(1);
}
if (!Number.isFinite(nextProvisions) || nextProvisions < 0) {
    console.error('Provisions must be a non-negative number.');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const commanders = Array.isArray(db.commanders) ? db.commanders : [];
const index = commanders.findIndex(
    (entry) => String(entry?.username || '').trim().toLowerCase() === username.toLowerCase()
);

if (index < 0) {
    console.error(`Commander not found: ${username}`);
    process.exit(1);
}

const previous = commanders[index].ageProvisions;
commanders[index].ageProvisions = nextProvisions;
db.commanders = commanders;

fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
console.log(`[NEXUS] ${username} ageProvisions: ${previous} → ${nextProvisions}`);

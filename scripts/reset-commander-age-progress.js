#!/usr/bin/env node
/**
 * One-off: reset one commander's Age rank, guild XP, army, gold, and provisions in db.json.
 * Usage: node scripts/reset-commander-age-progress.js <username>
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { buildCommanderRankResetLedgerPatch } = require('../nexus-age-commander-reset');

const dbPath = path.join(__dirname, '..', 'db.json');
const username = String(process.argv[2] || '').trim();

if (!username) {
    console.error('Usage: node scripts/reset-commander-age-progress.js <username>');
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

const before = commanders[index];
commanders[index] = {
    ...before,
    ...buildCommanderRankResetLedgerPatch(),
    ageGearSlots: null,
    ageGearLocked: false,
    ageGuildMerch: [],
    ageGuildPerks: null,
    ageGuildBonuses: null,
    army: []
};
db.commanders = commanders;

fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
console.log(`[NEXUS] Reset Age progress for ${username}:`, {
    rank: `${before.rank} → ${commanders[index].rank}`,
    ageGuildXp: `${before.ageGuildXp} → ${commanders[index].ageGuildXp}`,
    ageArmyStacks: `${(before.ageArmy || []).length} → 0`,
    ageGold: commanders[index].ageGold,
    ageProvisions: commanders[index].ageProvisions
});

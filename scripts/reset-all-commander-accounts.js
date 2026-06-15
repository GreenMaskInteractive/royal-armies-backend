#!/usr/bin/env node
/**
 * Reset every commander Age ledger while preserving achievements (awards + medals).
 * Clears portal.ageMovement commander positions.
 *
 * Usage: node scripts/reset-all-commander-accounts.js
 *
 * Stop NEXUS (npm start) before running locally — a live server may reload
 * stale in-memory ledger and overwrite db.json after this script finishes.
 *
 * Production: POST /api/portal/age/admin/reset-all-commander-accounts as an Age admin,
 * or wait for the automatic age-conclusion reset (portal.ageCampaign lifecycle on NEXUS).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { resetCommanderRecordPreservingAchievements } = require('../nexus-age-portal-join');

const dbPath = path.join(__dirname, '..', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const commanders = Array.isArray(db.commanders) ? db.commanders : [];

let resetCount = 0;
db.commanders = commanders.map((commander) => {
    if (!commander?.username) return commander;
    resetCount += 1;
    return resetCommanderRecordPreservingAchievements(commander);
});

if (!db.portal || typeof db.portal !== 'object') {
    db.portal = {};
}
if (!db.portal.ageMovement || typeof db.portal.ageMovement !== 'object') {
    db.portal.ageMovement = {};
}
db.portal.ageMovement.commanders = {};
db.portal.commanderAccountResetAt = new Date().toISOString();

fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
console.log(`[NEXUS] Reset ${resetCount} commander account(s). Achievements preserved; Age progress cleared.`);

#!/usr/bin/env node
/**
 * NEXUS — Backfill `terms_accepted_at` on commander ledger records (lowdb / db.json).
 *
 * Royal Armies stores accounts in `commanders[]`, not a SQL `users` table yet.
 * This script adds nullable `terms_accepted_at` (and camelCase `termsAcceptedAt`) to each row.
 *
 * Usage:
 *   node scripts/migrate-terms-accepted-at.js
 *   node scripts/migrate-terms-accepted-at.js --dry-run
 *
 * SQL equivalent: scripts/migrations/001_add_terms_accepted_at_to_users.sql
 */
'use strict';

const fs = require('fs');
const path = require('path');

const isProduction = process.env.RENDER === 'true';
const dbPath = isProduction
    ? '/data/db.json'
    : path.join(__dirname, '..', 'db.json');
const dryRun = process.argv.includes('--dry-run');

function readLedger() {
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Ledger not found at ${dbPath}`);
    }
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
}

function writeLedger(data) {
    fs.writeFileSync(dbPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function resolveExistingAcceptance(commander) {
    const at = commander.terms_accepted_at || commander.termsAcceptedAt;
    if (at) return String(at);
    if (commander.termsAccepted === true && commander.joinedAt) {
        return String(commander.joinedAt);
    }
    return null;
}

function migrate() {
    const ledger = readLedger();
    const commanders = Array.isArray(ledger.commanders) ? ledger.commanders : [];
    let touched = 0;
    let alreadySet = 0;

    commanders.forEach((commander) => {
        if (!commander || !commander.username) return;

        const existing = resolveExistingAcceptance(commander);
        if (existing) {
            if (!commander.terms_accepted_at || !commander.termsAcceptedAt) {
                commander.terms_accepted_at = existing;
                commander.termsAcceptedAt = existing;
                commander.termsAccepted = true;
                touched += 1;
            } else {
                alreadySet += 1;
            }
            return;
        }

        commander.terms_accepted_at = null;
        commander.termsAcceptedAt = null;
        if (commander.termsAccepted !== true) {
            commander.termsAccepted = false;
        }
        touched += 1;
    });

    console.log(`[NEXUS] migrate-terms-accepted-at`);
    console.log(`  Ledger: ${dbPath}`);
    console.log(`  Commanders: ${commanders.length}`);
    console.log(`  Updated / normalized: ${touched}`);
    console.log(`  Already complete: ${alreadySet}`);
    console.log(`  Pending acceptance (null timestamp): ${commanders.filter((c) => !resolveExistingAcceptance(c)).length}`);

    if (dryRun) {
        console.log('  Dry run — no writes performed.');
        return;
    }

    ledger.commanders = commanders;
    writeLedger(ledger);
    console.log('  Migration saved.');
}

try {
    migrate();
} catch (error) {
    console.error('[NEXUS] Migration failed:', error.message);
    process.exit(1);
}

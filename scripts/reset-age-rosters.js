#!/usr/bin/env node
/**
 * One-off: clear all commander ageArmy stacks and restore caleb_admin gold/provisions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    resetAllCommanderAgeArmies,
    applyAdminLedgerRestore,
    isAgeLedgerAdminUsername
} = require('../nexus-age-ledger-admin');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

resetAllCommanderAgeArmies(db.commanders);
db.commanders = (db.commanders || []).map((commander) => (
    isAgeLedgerAdminUsername(commander?.username)
        ? applyAdminLedgerRestore(commander)
        : commander
));

db.portal = db.portal || {};
db.portal['age-roster-gold-reset-v1'] = new Date().toISOString();

fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
console.log(`Reset ${db.commanders.length} commander roster(s) in ${dbPath}`);

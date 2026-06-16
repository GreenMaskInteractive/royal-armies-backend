#!/usr/bin/env node
/**
 * NEXUS — One-time seed of Render Postgres from a db.json export.
 *
 * Usage:
 *   set DATABASE_URL=postgres://...
 *   node scripts/seed-postgres-ledger.js path/to/db.json
 *
 * Download production db.json first (Render Shell: cat /data/db.json).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { ensurePostgresLedgerSchema } = require('../nexus-pg-ledger');

async function main() {
    const connectionString = String(process.env.DATABASE_URL || process.env.NEXUS_DATABASE_URL || '').trim();
    if (!connectionString) {
        console.error('[seed-postgres-ledger] DATABASE_URL is required.');
        process.exit(1);
    }

    const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'db.json'));
    if (!fs.existsSync(inputPath)) {
        console.error('[seed-postgres-ledger] File not found:', inputPath);
        process.exit(1);
    }

    const body = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    if (!body || typeof body !== 'object') {
        console.error('[seed-postgres-ledger] Invalid JSON ledger.');
        process.exit(1);
    }

    await ensurePostgresLedgerSchema(connectionString);

    const pool = new Pool({
        connectionString,
        ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });

    try {
        const result = await pool.query(
            `INSERT INTO nexus_ledger_snapshot (id, revision, body, updated_at)
             VALUES (1, 1, $1::jsonb, NOW())
             ON CONFLICT (id) DO UPDATE
             SET revision = nexus_ledger_snapshot.revision + 1,
                 body = EXCLUDED.body,
                 updated_at = NOW()
             RETURNING revision, updated_at`,
            [JSON.stringify(body)]
        );

        const row = result.rows[0];
        console.log('[seed-postgres-ledger] ok — revision', row?.revision, 'at', row?.updated_at);
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('[seed-postgres-ledger] failed:', err?.message || err);
    process.exit(1);
});

/**
 * NEXUS — Ledger bootstrap (local lowdb file or shared Postgres snapshot for split services).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { Pool } = require('pg');

const LEDGER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS nexus_ledger_snapshot (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    revision BIGINT NOT NULL DEFAULT 0,
    body JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

class PostgresSyncAdapter {
    constructor(options = {}) {
        this.pool = options.pool;
        this.dbPath = options.dbPath;
        this.defaultValue = options.defaultValue || {};
        this.state = structuredClone(this.defaultValue);
        this.revision = 0;
        this.persistTimer = null;
        this.persistInFlight = false;
        this.reloadTimer = null;
        this.hydrated = false;
        this.hydratePromise = null;
        this.reloadIntervalMs = Math.max(1000, Number(options.reloadIntervalMs) || 2500);
    }

    read() {
        return this.state;
    }

    write(nextState) {
        this.state = nextState;
        this.queuePersist(false);
    }

    queuePersist(immediate) {
        if (immediate) {
            void this.persistNow();
            return;
        }

        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
        }

        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            void this.persistNow();
        }, 120);
    }

    readFileSeed() {
        try {
            if (!this.dbPath || !fs.existsSync(this.dbPath)) return null;
            const raw = fs.readFileSync(this.dbPath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (err) {
            console.warn('[NEXUS] Ledger file seed read failed:', err?.message || err);
            return null;
        }
    }

    async hydrateFromPostgres() {
        if (this.hydratePromise) return this.hydratePromise;

        this.hydratePromise = (async () => {
            if (!this.pool) {
                this.hydrated = true;
                return;
            }

            try {
                await this.pool.query(LEDGER_TABLE_SQL);
                const result = await this.pool.query(
                    'SELECT revision, body FROM nexus_ledger_snapshot WHERE id = 1 LIMIT 1'
                );
                const row = result?.rows?.[0];

                if (row?.body && typeof row.body === 'object') {
                    this.state = row.body;
                    this.revision = Number(row.revision) || 0;
                } else {
                    const fileSeed = this.readFileSeed();
                    if (fileSeed) {
                        this.state = fileSeed;
                    }
                    await this.persistNow();
                }

                this.startReloadLoop();
            } catch (err) {
                console.warn('[NEXUS] Postgres ledger hydrate failed:', err?.message || err);
            } finally {
                this.hydrated = true;
            }
        })();

        return this.hydratePromise;
    }

    async persistNow() {
        if (!this.pool || this.persistInFlight) return;
        this.persistInFlight = true;

        try {
            const nextRevision = this.revision + 1;
            const result = await this.pool.query(
                `INSERT INTO nexus_ledger_snapshot (id, revision, body, updated_at)
                 VALUES (1, $1, $2::jsonb, NOW())
                 ON CONFLICT (id) DO UPDATE
                 SET revision = EXCLUDED.revision,
                     body = EXCLUDED.body,
                     updated_at = NOW()
                 RETURNING revision`,
                [nextRevision, JSON.stringify(this.state || {})]
            );
            this.revision = Number(result?.rows?.[0]?.revision) || nextRevision;
        } catch (err) {
            console.warn('[NEXUS] Postgres ledger persist failed:', err?.message || err);
        } finally {
            this.persistInFlight = false;
        }
    }

    startReloadLoop() {
        if (!this.pool || this.reloadTimer) return;

        this.reloadTimer = setInterval(() => {
            void this.reloadFromPostgres();
        }, this.reloadIntervalMs);

        if (typeof this.reloadTimer.unref === 'function') {
            this.reloadTimer.unref();
        }
    }

    async reloadFromPostgres() {
        if (!this.pool || this.persistInFlight) return;

        try {
            const result = await this.pool.query(
                'SELECT revision, body FROM nexus_ledger_snapshot WHERE id = 1 LIMIT 1'
            );
            const row = result?.rows?.[0];
            const remoteRevision = Number(row?.revision) || 0;
            if (remoteRevision > this.revision && row?.body && typeof row.body === 'object') {
                this.revision = remoteRevision;
                this.state = row.body;
            }
        } catch (err) {
            console.warn('[NEXUS] Postgres ledger reload failed:', err?.message || err);
        }
    }
}

let sharedPool = null;

function resolveDatabaseUrl() {
    return String(process.env.DATABASE_URL || process.env.NEXUS_DATABASE_URL || '').trim();
}

async function ensurePostgresLedgerSchema(connectionString) {
    const pool = new Pool({
        connectionString,
        ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });

    await pool.query(LEDGER_TABLE_SQL);
    await pool.end();
}

function createPostgresPool(connectionString) {
    if (sharedPool) return sharedPool;

    sharedPool = new Pool({
        connectionString,
        ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
        max: 5
    });

    sharedPool.on('error', (err) => {
        console.warn('[NEXUS] Postgres pool error:', err?.message || err);
    });

    return sharedPool;
}

function createNexusLedger(options = {}) {
    const dbPath = options.dbPath || path.join(__dirname, 'db.json');
    const defaults = options.defaults && typeof options.defaults === 'object' ? options.defaults : {};
    const connectionString = resolveDatabaseUrl();

    if (connectionString) {
        const pool = createPostgresPool(connectionString);
        const adapter = new PostgresSyncAdapter({
            pool,
            dbPath,
            defaultValue: defaults
        });

        const db = low(adapter);
        db.defaults(defaults).write();
        db.__nexusLedgerMode = 'postgres';
        db.__nexusLedgerAdapter = adapter;
        return db;
    }

    const adapter = new FileSync(dbPath);
    const db = low(adapter);
    db.defaults(defaults).write();
    db.__nexusLedgerMode = 'file';
    return db;
}

async function prepareNexusLedger(db) {
    if (!db || db.__nexusLedgerMode !== 'postgres') return db;
    const adapter = db.__nexusLedgerAdapter;
    if (adapter && typeof adapter.hydrateFromPostgres === 'function') {
        await adapter.hydrateFromPostgres();
    }
    return db;
}

module.exports = {
    createNexusLedger,
    prepareNexusLedger,
    ensurePostgresLedgerSchema,
    resolveDatabaseUrl,
    PostgresSyncAdapter
};

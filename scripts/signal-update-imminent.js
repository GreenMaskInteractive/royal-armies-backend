#!/usr/bin/env node
/**
 * NEXUS helper — flag an imminent production deploy so connected clients show the update notice early.
 * Usage: node scripts/signal-update-imminent.js [baseUrl]
 * Env: MAINTENANCE_ALERT_DEV_KEY (default local-dev-maintenance)
 */
'use strict';

const https = require('https');
const http = require('http');

const baseUrl = String(process.argv[2] || process.env.ROYAL_ARMIES_API_BASE || 'https://royalarmies.com').replace(/\/$/, '');
const devKey = String(process.env.MAINTENANCE_ALERT_DEV_KEY || 'local-dev-maintenance').trim();
const url = new URL(`${baseUrl}/api/portal/maintenance-alert`);
const client = url.protocol === 'https:' ? https : http;

const body = JSON.stringify({ updateImminent: true });

const req = client.request(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Dev-Key': devKey
    }
}, (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error('[signal-update-imminent] failed', res.statusCode, raw);
            process.exit(1);
        }
        console.log('[signal-update-imminent] ok — clients should see the update notice within ~3s');
        process.exit(0);
    });
});

req.on('error', (err) => {
    console.error('[signal-update-imminent] error', err.message);
    process.exit(1);
});

req.write(body);
req.end();

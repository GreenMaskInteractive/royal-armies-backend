/**
 * [NEXUS] Trailer MP4 render job status, remote sync, and publish helpers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, 'runtime');
const STATUS_PATH = path.join(RUNTIME_DIR, 'trailer-render-status.json');
const RENDER_SCRIPT = path.join(ROOT, 'scripts', 'render-trailer-video.js');
const DIST_MP4 = path.join(ROOT, 'dist', 'trailer', 'royal-armies-age-of-war-trailer.mp4');
const PUBLIC_MP4 = path.join(ROOT, 'public', 'season', 'royal-armies-age-of-war-trailer.mp4');
const PUBLIC_MP4_URL = 'season/royal-armies-age-of-war-trailer.mp4';
const DEFAULT_REMOTE_SYNC_URL = 'https://www.royalarmies.com/api/portal/trailer/render/progress';

/** @type {import('child_process').ChildProcess | null} */
let activeRenderChild = null;

function ensureRuntimeDir() {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function defaultStatus() {
    return {
        status: 'idle',
        phase: 'idle',
        percent: 0,
        frame: 0,
        totalFrames: 0,
        durationSec: 0,
        message: 'Idle',
        mp4Available: fs.existsSync(PUBLIC_MP4),
        publicUrl: PUBLIC_MP4_URL,
        outputPath: null,
        error: null,
        startedAt: null,
        updatedAt: null,
        finishedAt: null,
        timeSec: null,
    };
}

function sanitizeTrailerRenderProgressPayload(payload) {
    const input = payload && typeof payload === 'object' ? payload : {};
    const next = {
        status: typeof input.status === 'string' ? input.status : undefined,
        phase: typeof input.phase === 'string' ? input.phase : undefined,
        percent: Number.isFinite(Number(input.percent)) ? Number(input.percent) : undefined,
        frame: Number.isFinite(Number(input.frame)) ? Number(input.frame) : undefined,
        totalFrames: Number.isFinite(Number(input.totalFrames)) ? Number(input.totalFrames) : undefined,
        durationSec: Number.isFinite(Number(input.durationSec)) ? Number(input.durationSec) : undefined,
        message: typeof input.message === 'string' ? input.message.slice(0, 240) : undefined,
        outputPath: typeof input.outputPath === 'string' ? input.outputPath.slice(0, 512) : undefined,
        error: typeof input.error === 'string' ? input.error.slice(0, 512) : undefined,
        startedAt: typeof input.startedAt === 'string' ? input.startedAt : undefined,
        finishedAt: typeof input.finishedAt === 'string' ? input.finishedAt : undefined,
        timeSec: Number.isFinite(Number(input.timeSec)) ? Number(input.timeSec) : undefined,
    };

    Object.keys(next).forEach((key) => {
        if (next[key] === undefined) delete next[key];
    });

    return next;
}

function normalizeTrailerRenderStatusRecord(stored) {
    if (!stored || typeof stored !== 'object') {
        return defaultStatus();
    }

    return {
        ...defaultStatus(),
        ...stored,
        mp4Available: fs.existsSync(PUBLIC_MP4),
        publicUrl: PUBLIC_MP4_URL,
    };
}

function readTrailerRenderStatus() {
    ensureRuntimeDir();

    if (!fs.existsSync(STATUS_PATH)) {
        return defaultStatus();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
        return normalizeTrailerRenderStatusRecord(parsed);
    } catch (_err) {
        return defaultStatus();
    }
}

function readTrailerRenderRemoteStatus(db) {
    if (!db || typeof db.get !== 'function') {
        return null;
    }

    const stored = db.get('portal.trailerRenderStatus').value();
    if (!stored || typeof stored !== 'object') {
        return null;
    }

    return normalizeTrailerRenderStatusRecord(stored);
}

function writeTrailerRenderRemoteStatus(db, patch) {
    const current = readTrailerRenderRemoteStatus(db) || defaultStatus();
    const next = normalizeTrailerRenderStatusRecord({
        ...current,
        ...sanitizeTrailerRenderProgressPayload(patch),
        updatedAt: new Date().toISOString(),
    });

    db.set('portal.trailerRenderStatus', next).write();
    return next;
}

function writeTrailerRenderStatus(patch) {
    ensureRuntimeDir();

    const current = readTrailerRenderStatus();
    const next = normalizeTrailerRenderStatusRecord({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
    });

    fs.writeFileSync(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    queueTrailerRenderRemoteSync(next);
    return next;
}

function getTrailerRenderSyncSecret() {
    return String(process.env.TRAILER_RENDER_SYNC_SECRET || '').trim();
}

function resolveTrailerRenderSyncConfig() {
    const secret = getTrailerRenderSyncSecret();
    const url = String(process.env.TRAILER_RENDER_SYNC_URL || DEFAULT_REMOTE_SYNC_URL).trim();

    if (!secret || process.env.TRAILER_RENDER_SYNC === '0') {
        return { enabled: false, secret: '', url: '' };
    }

    return {
        enabled: true,
        secret,
        url,
    };
}

function syncTrailerRenderStatusRemote(status, config) {
    const syncConfig = config || resolveTrailerRenderSyncConfig();
    if (!syncConfig.enabled) {
        return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
        let target;
        try {
            target = new URL(syncConfig.url);
        } catch (error) {
            reject(error);
            return;
        }

        const body = JSON.stringify(sanitizeTrailerRenderProgressPayload(status));
        const lib = target.protocol === 'https:' ? https : http;
        const req = lib.request({
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: `${target.pathname}${target.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-Trailer-Render-Secret': syncConfig.secret,
            },
        }, (res) => {
            res.resume();
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                    return;
                }
                reject(new Error(`Remote trailer render sync failed with HTTP ${res.statusCode}`));
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function queueTrailerRenderRemoteSync(status) {
    const config = resolveTrailerRenderSyncConfig();
    if (!config.enabled) return;

    syncTrailerRenderStatusRemote(status, config).catch((error) => {
        console.warn('[NEXUS] Trailer render remote sync failed:', error.message);
    });
}

function pickTrailerRenderStatus(localStatus, remoteStatus) {
    const candidates = [localStatus, remoteStatus].filter(Boolean);
    if (!candidates.length) {
        return defaultStatus();
    }

    const rendering = candidates.filter((entry) => entry.status === 'rendering');
    if (rendering.length) {
        return rendering.sort(
            (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
        )[0];
    }

    const complete = candidates.filter((entry) => entry.status === 'complete');
    if (complete.length) {
        return complete.sort(
            (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
        )[0];
    }

    const errored = candidates.filter((entry) => entry.status === 'error');
    if (errored.length) {
        return errored.sort(
            (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
        )[0];
    }

    return candidates.sort(
        (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
    )[0];
}

function markTrailerRenderStarting(options) {
    return writeTrailerRenderStatus({
        status: 'rendering',
        phase: 'starting',
        percent: 0,
        frame: 0,
        totalFrames: Number(options?.totalFrames) || 0,
        durationSec: Number(options?.durationSec) || 0,
        message: 'Starting trailer render…',
        outputPath: null,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        timeSec: 0,
    });
}

function markTrailerRenderProgress(patch) {
    const current = readTrailerRenderStatus();
    if (current.status !== 'rendering') {
        return current;
    }

    return writeTrailerRenderStatus({
        status: 'rendering',
        ...patch,
    });
}

function publishTrailerMp4ToPublic(sourcePath) {
    const source = sourcePath || DIST_MP4;
    if (!fs.existsSync(source)) {
        throw new Error(`Trailer MP4 not found: ${source}`);
    }

    fs.mkdirSync(path.dirname(PUBLIC_MP4), { recursive: true });
    fs.copyFileSync(source, PUBLIC_MP4);
    return PUBLIC_MP4;
}

function markTrailerRenderComplete(outputPath) {
    publishTrailerMp4ToPublic(outputPath);

    return writeTrailerRenderStatus({
        status: 'complete',
        phase: 'complete',
        percent: 100,
        message: 'Trailer video ready',
        outputPath: outputPath || DIST_MP4,
        mp4Available: true,
        error: null,
        finishedAt: new Date().toISOString(),
    });
}

function markTrailerRenderFailed(error) {
    const message = error instanceof Error ? error.message : String(error || 'Render failed');

    return writeTrailerRenderStatus({
        status: 'error',
        phase: 'error',
        message,
        error: message,
        finishedAt: new Date().toISOString(),
    });
}

function isTrailerRenderRunning(localStatus, remoteStatus) {
    if (activeRenderChild && !activeRenderChild.killed) {
        return true;
    }

    const picked = pickTrailerRenderStatus(localStatus || readTrailerRenderStatus(), remoteStatus || null);
    return picked.status === 'rendering';
}

function getTrailerRenderStatusPayload(db) {
    const local = readTrailerRenderStatus();
    const remote = readTrailerRenderRemoteStatus(db);
    const status = pickTrailerRenderStatus(local, remote);

    return {
        ...status,
        running: isTrailerRenderRunning(local, remote),
        syncEnabled: resolveTrailerRenderSyncConfig().enabled,
    };
}

function verifyTrailerRenderSyncSecret(req) {
    const expected = getTrailerRenderSyncSecret();
    if (!expected) {
        return false;
    }

    const provided = String(
        req?.headers?.['x-trailer-render-secret']
        || req?.headers?.['x-trailer-render-sync-secret']
        || ''
    ).trim();

    return Boolean(provided) && provided === expected;
}

function startTrailerRenderJob(options) {
    if (isTrailerRenderRunning()) {
        return {
            started: false,
            reason: 'already-running',
            status: getTrailerRenderStatusPayload(),
        };
    }

    const previewSec = Math.max(0, Number(options?.previewSec) || 0);
    const args = [RENDER_SCRIPT];
    if (previewSec > 0) {
        args.push('--preview-sec', String(previewSec));
    }

    markTrailerRenderStarting({
        durationSec: previewSec > 0 ? previewSec : 0,
    });

    activeRenderChild = spawn(process.execPath, args, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
    });

    activeRenderChild.on('exit', (code) => {
        activeRenderChild = null;
        const status = readTrailerRenderStatus();
        if (code !== 0 && status.status === 'rendering') {
            markTrailerRenderFailed(new Error(`Render process exited with code ${code}`));
        }
    });

    activeRenderChild.on('error', (err) => {
        activeRenderChild = null;
        markTrailerRenderFailed(err);
    });

    return {
        started: true,
        status: getTrailerRenderStatusPayload(),
    };
}

function canStartTrailerRenderFromRequest(req) {
    if (process.env.TRAILER_RENDER_API === '1') {
        return true;
    }

    if (process.env.RENDER === 'true') {
        return false;
    }

    const host = String(req?.hostname || req?.headers?.host || '').split(':')[0].toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

module.exports = {
    STATUS_PATH,
    PUBLIC_MP4,
    PUBLIC_MP4_URL,
    DIST_MP4,
    DEFAULT_REMOTE_SYNC_URL,
    readTrailerRenderStatus,
    readTrailerRenderRemoteStatus,
    writeTrailerRenderStatus,
    writeTrailerRenderRemoteStatus,
    markTrailerRenderStarting,
    markTrailerRenderProgress,
    markTrailerRenderComplete,
    markTrailerRenderFailed,
    publishTrailerMp4ToPublic,
    sanitizeTrailerRenderProgressPayload,
    verifyTrailerRenderSyncSecret,
    resolveTrailerRenderSyncConfig,
    syncTrailerRenderStatusRemote,
    getTrailerRenderStatusPayload,
    startTrailerRenderJob,
    canStartTrailerRenderFromRequest,
};

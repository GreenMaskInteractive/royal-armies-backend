/**
 * [NEXUS] Trailer MP4 render job status and publish helpers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, 'runtime');
const STATUS_PATH = path.join(RUNTIME_DIR, 'trailer-render-status.json');
const RENDER_SCRIPT = path.join(ROOT, 'scripts', 'render-trailer-video.js');
const DIST_MP4 = path.join(ROOT, 'dist', 'trailer', 'royal-armies-age-of-war-trailer.mp4');
const PUBLIC_MP4 = path.join(ROOT, 'public', 'season', 'royal-armies-age-of-war-trailer.mp4');
const PUBLIC_MP4_URL = 'season/royal-armies-age-of-war-trailer.mp4';

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
    };
}

function readTrailerRenderStatus() {
    ensureRuntimeDir();

    if (!fs.existsSync(STATUS_PATH)) {
        return defaultStatus();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
        return {
            ...defaultStatus(),
            ...parsed,
            mp4Available: fs.existsSync(PUBLIC_MP4),
            publicUrl: PUBLIC_MP4_URL,
        };
    } catch (_err) {
        return defaultStatus();
    }
}

function writeTrailerRenderStatus(patch) {
    ensureRuntimeDir();

    const current = readTrailerRenderStatus();
    const next = {
        ...current,
        ...patch,
        mp4Available: fs.existsSync(PUBLIC_MP4),
        publicUrl: PUBLIC_MP4_URL,
        updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
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
    });
}

function markTrailerRenderProgress(patch) {
    const current = readTrailerRenderStatus();
    if (current.status !== 'rendering') {
        return current;
    }

    return writeTrailerRenderStatus(patch);
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

function isTrailerRenderRunning() {
    if (activeRenderChild && !activeRenderChild.killed) {
        return true;
    }

    const status = readTrailerRenderStatus();
    return status.status === 'rendering';
}

function getTrailerRenderStatusPayload() {
    const status = readTrailerRenderStatus();
    return {
        ...status,
        running: isTrailerRenderRunning(),
    };
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
    readTrailerRenderStatus,
    writeTrailerRenderStatus,
    markTrailerRenderStarting,
    markTrailerRenderProgress,
    markTrailerRenderComplete,
    markTrailerRenderFailed,
    publishTrailerMp4ToPublic,
    isTrailerRenderRunning,
    getTrailerRenderStatusPayload,
    startTrailerRenderJob,
    canStartTrailerRenderFromRequest,
};

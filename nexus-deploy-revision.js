/**
 * NEXUS — Per-process deploy identity for early client update notices.
 * bootId changes on every server restart (e.g. Render deploy); revision tracks git when available.
 */
'use strict';

const SERVER_BOOT_ID = `boot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const SERVER_STARTED_AT = new Date().toISOString();

function resolveDeployRevision() {
    const candidates = [
        process.env.RENDER_GIT_COMMIT,
        process.env.RENDER_GIT_BRANCH,
        process.env.GIT_COMMIT,
        process.env.VERCEL_GIT_COMMIT_SHA,
        process.env.SOURCE_VERSION,
        process.env.COMMIT_REF
    ];

    for (const raw of candidates) {
        const value = String(raw || '').trim();
        if (value) return value.slice(0, 64);
    }

    return SERVER_BOOT_ID;
}

function getDeployStatePayload() {
    return {
        bootId: SERVER_BOOT_ID,
        revision: resolveDeployRevision(),
        startedAt: SERVER_STARTED_AT
    };
}

module.exports = {
    SERVER_BOOT_ID,
    SERVER_STARTED_AT,
    resolveDeployRevision,
    getDeployStatePayload
};

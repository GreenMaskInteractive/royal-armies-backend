/**
 * NEXUS — Player report screenshot attachments (disk-backed).
 */
const fs = require('fs');
const path = require('path');

const REPORT_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
const REPORT_SCREENSHOT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
]);

const MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

function getScreenshotDirectory(rootDir) {
    return path.join(rootDir, 'runtime', 'player-report-screenshots');
}

function parseScreenshotPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const mimeType = String(raw.mimeType || raw.type || '').trim().toLowerCase();
    let base64 = String(raw.base64 || '').trim();
    const dataUrl = String(raw.dataUrl || '').trim();

    if (dataUrl.startsWith('data:')) {
        const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
        if (!match) return null;
        const parsedMime = match[1].toLowerCase();
        if (!REPORT_SCREENSHOT_MIME_TYPES.has(parsedMime)) return null;
        return {
            mimeType: parsedMime === 'image/jpg' ? 'image/jpeg' : parsedMime,
            buffer: Buffer.from(match[2], 'base64')
        };
    }

    if (!base64 || !mimeType) return null;
    const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
    if (!REPORT_SCREENSHOT_MIME_TYPES.has(normalizedMime)) return null;

    const commaIdx = base64.indexOf(',');
    if (commaIdx >= 0) base64 = base64.slice(commaIdx + 1);

    return {
        mimeType: normalizedMime,
        buffer: Buffer.from(base64, 'base64')
    };
}

function validateScreenshotBuffer(buffer, mimeType) {
    if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
        return { ok: false, errorCode: 'NEXUS-REPORT-006', message: 'Screenshot file is empty or unreadable.' };
    }
    if (!REPORT_SCREENSHOT_MIME_TYPES.has(mimeType)) {
        return { ok: false, errorCode: 'NEXUS-REPORT-006', message: 'Screenshot must be PNG, JPG, WebP, or GIF.' };
    }
    if (buffer.length > REPORT_SCREENSHOT_MAX_BYTES) {
        return {
            ok: false,
            errorCode: 'NEXUS-REPORT-006',
            message: 'Screenshot must be 2 MB or smaller.'
        };
    }
    return { ok: true, buffer, mimeType };
}

function savePlayerReportScreenshot(rootDir, reportId, parsed) {
    const validation = validateScreenshotBuffer(parsed?.buffer, parsed?.mimeType);
    if (!validation.ok) return validation;

    const ext = MIME_TO_EXT[validation.mimeType] || 'png';
    const dir = getScreenshotDirectory(rootDir);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${String(reportId || '').trim()}.${ext}`;
    const absolutePath = path.join(dir, filename);
    fs.writeFileSync(absolutePath, validation.buffer);

    return {
        ok: true,
        screenshot: {
            filename,
            mimeType: validation.mimeType,
            byteSize: validation.buffer.length,
            storagePath: `runtime/player-report-screenshots/${filename}`
        }
    };
}

module.exports = {
    REPORT_SCREENSHOT_MAX_BYTES,
    REPORT_SCREENSHOT_MIME_TYPES,
    parseScreenshotPayload,
    validateScreenshotBuffer,
    savePlayerReportScreenshot,
    getScreenshotDirectory
};

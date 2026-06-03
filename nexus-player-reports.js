/**
 * NEXUS — Player conduct reports (ledger-backed moderation queue).
 */

const REPORT_CATEGORIES = {
    harassment: {
        id: 'harassment',
        label: 'Harassment or bullying'
    },
    hate_speech: {
        id: 'hate_speech',
        label: 'Hate speech or slurs'
    },
    cheating: {
        id: 'cheating',
        label: 'Cheating or exploits'
    },
    spam: {
        id: 'spam',
        label: 'Spam or scam attempts'
    },
    impersonation: {
        id: 'impersonation',
        label: 'Impersonation or fraud'
    },
    other: {
        id: 'other',
        label: 'Other rule violation'
    }
};

const REPORT_SOURCES = new Set([
    'profile',
    'community_chat',
    'age_city_roster',
    'game_chat',
    'commander_menu',
    'other'
]);

const REPORT_DETAILS_MIN = 20;
const REPORT_DETAILS_MAX = 2000;
const REPORT_CONTEXT_MAX = 500;
const REPORT_DAILY_LIMIT = 8;
const REPORT_DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000;
const REPORT_ID_PREFIX = 'rpt_';

function normalizeReportCategory(value) {
    const key = String(value || '').trim().toLowerCase();
    return REPORT_CATEGORIES[key] ? key : '';
}

function normalizeReportSource(value) {
    const key = String(value || '').trim().toLowerCase();
    return REPORT_SOURCES.has(key) ? key : 'other';
}

function buildPlayerReportRecord({
    reporterUsername,
    targetUsername,
    category,
    details,
    source,
    contextLabel,
    contextMeta,
    clientIp,
    userAgent
}) {
    const createdAt = new Date().toISOString();
    return {
        id: `${REPORT_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        reporterUsername,
        targetUsername,
        category,
        details,
        source,
        contextLabel: contextLabel || '',
        contextMeta: contextMeta && typeof contextMeta === 'object' ? contextMeta : {},
        status: 'open',
        createdAt,
        clientIp: clientIp || '',
        userAgent: userAgent || ''
    };
}

function findRecentReporterReports(reports, reporterUsername, sinceMs) {
    const reporterLower = String(reporterUsername || '').trim().toLowerCase();
    if (!reporterLower) return [];

    const cutoff = Date.now() - sinceMs;
    return (Array.isArray(reports) ? reports : []).filter((row) => {
        if (!row || String(row.reporterUsername || '').trim().toLowerCase() !== reporterLower) return false;
        const createdMs = Date.parse(row.createdAt || '');
        return Number.isFinite(createdMs) && createdMs >= cutoff;
    });
}

function validatePlayerReportSubmission({
    reports,
    reporterUsername,
    targetUsername,
    category,
    details,
    source
}) {
    const reporter = String(reporterUsername || '').trim();
    const target = String(targetUsername || '').trim();
    const normalizedCategory = normalizeReportCategory(category);
    const normalizedSource = normalizeReportSource(source);
    const trimmedDetails = String(details || '').trim();

    if (!reporter) {
        return { ok: false, errorCode: 'NEXUS-GEN-002' };
    }
    if (!target) {
        return { ok: false, errorCode: 'NEXUS-REPORT-001', message: 'Select a commander to report.' };
    }
    if (reporter.toLowerCase() === target.toLowerCase()) {
        return { ok: false, errorCode: 'NEXUS-REPORT-002' };
    }
    if (!normalizedCategory) {
        return { ok: false, errorCode: 'NEXUS-REPORT-003' };
    }
    if (trimmedDetails.length < REPORT_DETAILS_MIN) {
        return {
            ok: false,
            errorCode: 'NEXUS-REPORT-001',
            message: `Please provide at least ${REPORT_DETAILS_MIN} characters describing the incident.`
        };
    }
    if (trimmedDetails.length > REPORT_DETAILS_MAX) {
        return { ok: false, errorCode: 'NEXUS-REPORT-001', message: 'Report details are too long.' };
    }

    const recentDay = findRecentReporterReports(reports, reporter, 24 * 60 * 60 * 1000);
    if (recentDay.length >= REPORT_DAILY_LIMIT) {
        return { ok: false, errorCode: 'NEXUS-REPORT-004' };
    }

    const duplicateRecent = findRecentReporterReports(reports, reporter, REPORT_DUPLICATE_WINDOW_MS)
        .some((row) => (
            String(row.targetUsername || '').trim().toLowerCase() === target.toLowerCase()
            && String(row.category || '').trim().toLowerCase() === normalizedCategory
        ));
    if (duplicateRecent) {
        return { ok: false, errorCode: 'NEXUS-REPORT-004' };
    }

    return {
        ok: true,
        reporterUsername: reporter,
        targetUsername: target,
        category: normalizedCategory,
        details: trimmedDetails.slice(0, REPORT_DETAILS_MAX),
        source: normalizedSource
    };
}

function buildPlayerReportAdminMailBody(report) {
    const categoryLabel = REPORT_CATEGORIES[report.category]?.label || report.category;
    const lines = [
        `Reporter: ${report.reporterUsername}`,
        `Reported commander: ${report.targetUsername}`,
        `Category: ${categoryLabel}`,
        `Source: ${report.source}`,
        `Submitted: ${report.createdAt}`,
        `Report ID: ${report.id}`
    ];

    if (report.contextLabel) {
        lines.push('', 'Context:', report.contextLabel);
    }

    lines.push('', 'Details:', report.details);
    return lines.join('\n');
}

module.exports = {
    REPORT_CATEGORIES,
    REPORT_SOURCES,
    REPORT_DETAILS_MIN,
    REPORT_DETAILS_MAX,
    REPORT_CONTEXT_MAX,
    normalizeReportCategory,
    normalizeReportSource,
    buildPlayerReportRecord,
    validatePlayerReportSubmission,
    buildPlayerReportAdminMailBody,
    findRecentReporterReports
};

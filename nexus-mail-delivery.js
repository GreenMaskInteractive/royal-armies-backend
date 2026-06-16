/**
 * NEXUS — Transactional mail via Resend (verification, alerts, status notifications).
 */
'use strict';

const { Resend } = require('resend');

const DEFAULT_FROM = 'Royal Armies <noreply@royalarmies.com>';

function resolveResendApiKey() {
    return String(
        process.env.RESEND_API_KEY
        || process.env.ROYAL_ARMIES_RESEND_API_KEY
        || ''
    ).trim();
}

function resolveResendClient() {
    const apiKey = resolveResendApiKey();
    if (!apiKey) return null;
    return new Resend(apiKey);
}

function resolveStatusAlertEmail() {
    const configured = String(
        process.env.STATUS_ALERT_EMAIL
        || process.env.NEXUS_STATUS_ALERT_EMAIL
        || process.env.ROYAL_ARMIES_STATUS_ALERT_EMAIL
        || ''
    ).trim();
    if (configured) return configured;

    const owner = String(process.env.OWNER_ALERT_EMAIL || process.env.ROYAL_ARMIES_OWNER_EMAIL || '').trim();
    return owner || null;
}

async function sendTransactionalEmail(options = {}) {
    const client = resolveResendClient();
    if (!client) {
        console.warn('[NEXUS] Resend API key missing — email not sent.');
        return { ok: false, error: 'missing-api-key' };
    }

    const to = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to].filter(Boolean);
    if (!to.length) {
        return { ok: false, error: 'missing-recipient' };
    }

    try {
        const { data, error } = await client.emails.send({
            from: options.from || DEFAULT_FROM,
            to,
            subject: options.subject || 'Royal Armies',
            html: options.html || '<p>Royal Armies notification.</p>',
            text: options.text || undefined
        });

        if (error) {
            console.warn('[NEXUS] Resend send failed:', error);
            return { ok: false, error };
        }

        return { ok: true, data };
    } catch (err) {
        console.warn('[NEXUS] Resend send exception:', err?.message || err);
        return { ok: false, error: err?.message || 'send-failed' };
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function sendStatusAlertEmail(payload = {}) {
    const recipient = resolveStatusAlertEmail();
    if (!recipient) {
        console.warn('[NEXUS] STATUS_ALERT_EMAIL not configured — status alert skipped.');
        return { ok: false, error: 'missing-status-alert-email' };
    }

    const severity = String(payload.severity || 'warning').trim().toLowerCase();
    const severityLabel = severity === 'critical' ? 'OFFLINE' : 'DEGRADED';
    const subjectPrefix = severity === 'critical' ? '[Royal Armies OFFLINE]' : '[Royal Armies DEGRADED]';
    const components = Array.isArray(payload.components) ? payload.components : [];
    const checkedAt = payload.checkedAt || new Date().toISOString();

    const rowsHtml = components.map((entry) => {
        const status = String(entry.status || 'unknown').toUpperCase();
        const detail = escapeHtml(entry.detail || entry.message || 'No detail recorded.');
        return `
            <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #2a2418;color:#f1e0ac;">${escapeHtml(entry.label || entry.id || 'Component')}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #2a2418;color:${entry.status === 'critical' ? '#ff6b6b' : '#f0c040'};font-weight:bold;">${escapeHtml(status)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #2a2418;color:#c8b990;">${detail}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <div style="font-family:Georgia,serif;background:#0b0a08;color:#f1e0ac;padding:32px;border:2px solid #d4af37;">
            <h1 style="color:#d4af37;margin:0 0 12px;">Royal Armies — ${escapeHtml(severityLabel)} Status Alert</h1>
            <p style="line-height:1.6;color:#c8b990;">One or more monitored systems reported ${escapeHtml(severityLabel.toLowerCase())} health at <strong>${escapeHtml(checkedAt)}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:20px;background:#12100d;">
                <thead>
                    <tr>
                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #d4af37;color:#d4af37;">Component</th>
                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #d4af37;color:#d4af37;">Status</th>
                        <th align="left" style="padding:10px 12px;border-bottom:2px solid #d4af37;color:#d4af37;">Detail</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml || '<tr><td colspan="3" style="padding:12px;">No component rows supplied.</td></tr>'}</tbody>
            </table>
            <p style="margin-top:24px;font-size:0.9rem;color:#888;">Visit the public status page for live checks: ${escapeHtml(payload.statusPageUrl || 'https://royalarmies.com/status')}</p>
        </div>
    `;

    return sendTransactionalEmail({
        to: [recipient],
        subject: `${subjectPrefix} ${components.length} component(s) need attention`,
        html
    });
}

module.exports = {
    DEFAULT_FROM,
    resolveResendApiKey,
    resolveResendClient,
    resolveStatusAlertEmail,
    sendTransactionalEmail,
    sendStatusAlertEmail
};

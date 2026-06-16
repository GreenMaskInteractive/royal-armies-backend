/**
 * NEXUS — Component health probes + alert email dispatch for the public status page.
 */
'use strict';

const http = require('http');
const https = require('https');
const { sendStatusAlertEmail } = require('./nexus-mail-delivery');
const {
    resolveServiceTierConfig,
    resolveStatusMonitorPeerConfig
} = require('./nexus-service-tier');
const { getDeployStatePayload } = require('./nexus-deploy-revision');

const STATUS_LEVEL = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    CRITICAL: 'critical'
};

const ALERT_COOLDOWN_MS = Math.max(60000, Number(process.env.STATUS_ALERT_COOLDOWN_MS) || 15 * 60 * 1000);
const MONITOR_INTERVAL_MS = Math.max(5000, Number(process.env.STATUS_MONITOR_INTERVAL_MS) || 30000);

const lastAlertSentAtByKey = new Map();
let monitorTimer = null;
let lastSnapshotKey = '';

function buildComponentCatalog(peerConfig = {}) {
    const portalBase = peerConfig.portalBaseUrl || 'http://127.0.0.1:3000';
    const gameBase = peerConfig.gameBaseUrl || 'http://127.0.0.1:3001';
    const statusBase = peerConfig.statusBaseUrl || portalBase;

    return [
        {
            id: 'portal-main',
            label: 'Main Portal',
            group: 'Portal',
            description: 'Community hub, Age Portal home, and account landing pages.',
            probe: { method: 'GET', url: `${portalBase}/api/health/live`, tier: 'portal' }
        },
        {
            id: 'community-chat',
            label: 'Community Chat',
            group: 'Portal',
            description: 'Nation-wide community chat channels on the main portal.',
            probe: { method: 'GET', url: `${portalBase}/api/health/community-chat`, tier: 'portal' }
        },
        {
            id: 'messaging',
            label: 'Commander Messaging',
            group: 'Portal',
            description: 'Mailbox, drafts, and staff/player messaging on the portal.',
            probe: { method: 'GET', url: `${portalBase}/api/health/messaging`, tier: 'portal' }
        },
        {
            id: 'authentication',
            label: 'Authentication',
            group: 'Portal',
            description: 'Login, session validation, and account security endpoints.',
            probe: { method: 'GET', url: `${portalBase}/api/health/authentication`, tier: 'portal' }
        },
        {
            id: 'game-shell',
            label: 'Game Client',
            group: 'Game',
            description: 'Game and Age client pages plus core game APIs.',
            probe: { method: 'GET', url: `${gameBase}/api/health/live`, tier: 'game' }
        },
        {
            id: 'game-chat',
            label: 'Game Chat',
            group: 'Game',
            description: 'In-age global, country, and alliance chat channels.',
            probe: { method: 'GET', url: `${gameBase}/api/health/game-chat`, tier: 'game' }
        },
        {
            id: 'battle-sim',
            label: 'Battle Simulation',
            group: 'Game',
            description: 'Guild training battles and Age combat simulation pipeline.',
            probe: { method: 'GET', url: `${gameBase}/api/health/battle-sim`, tier: 'game' }
        },
        {
            id: 'age-movement',
            label: 'Age Movement',
            group: 'Game',
            description: 'Travel, assault validation, and movement state services.',
            probe: { method: 'GET', url: `${gameBase}/api/health/age-movement`, tier: 'game' }
        },
        {
            id: 'status-page',
            label: 'Status Page',
            group: 'Operations',
            description: 'Public operational status dashboard and probe APIs.',
            probe: { method: 'GET', url: `${statusBase}/api/health/live`, tier: 'status' }
        }
    ];
}

function resolveHttpClient(urlString) {
    return String(urlString || '').startsWith('https:') ? https : http;
}

function probeHttpTarget(probe, timeoutMs = 8000) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (payload) => {
            if (settled) return;
            settled = true;
            resolve(payload);
        };

        let urlObject;
        try {
            urlObject = new URL(probe.url);
        } catch (_err) {
            finish({
                ok: false,
                status: STATUS_LEVEL.CRITICAL,
                detail: 'Invalid probe URL.',
                latencyMs: null
            });
            return;
        }

        const client = resolveHttpClient(urlObject.href);
        const started = Date.now();
        const request = client.request(urlObject, {
            method: probe.method || 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'RoyalArmiesStatusMonitor/1.0'
            },
            timeout: timeoutMs
        }, (response) => {
            let raw = '';
            response.on('data', (chunk) => { raw += chunk; });
            response.on('end', () => {
                const latencyMs = Date.now() - started;
                let payload = null;
                try {
                    payload = raw ? JSON.parse(raw) : null;
                } catch (_err) {
                    payload = null;
                }

                const httpOk = response.statusCode >= 200 && response.statusCode < 300;
                const componentStatus = String(payload?.status || payload?.componentStatus || '').toLowerCase();
                let status = STATUS_LEVEL.HEALTHY;

                if (!httpOk) {
                    status = response.statusCode >= 500 ? STATUS_LEVEL.CRITICAL : STATUS_LEVEL.DEGRADED;
                } else if (componentStatus === 'degraded' || componentStatus === 'warning') {
                    status = STATUS_LEVEL.DEGRADED;
                } else if (componentStatus === 'critical' || componentStatus === 'offline') {
                    status = STATUS_LEVEL.CRITICAL;
                }

                finish({
                    ok: httpOk,
                    status,
                    detail: payload?.detail || payload?.message || `HTTP ${response.statusCode}`,
                    latencyMs,
                    payload
                });
            });
        });

        request.on('timeout', () => {
            request.destroy(new Error('probe-timeout'));
        });

        request.on('error', (err) => {
            finish({
                ok: false,
                status: STATUS_LEVEL.CRITICAL,
                detail: err?.message || 'Probe failed.',
                latencyMs: Date.now() - started
            });
        });

        request.end();
    });
}

function summarizeOverallStatus(components) {
    if (components.some((entry) => entry.status === STATUS_LEVEL.CRITICAL)) {
        return STATUS_LEVEL.CRITICAL;
    }
    if (components.some((entry) => entry.status === STATUS_LEVEL.DEGRADED)) {
        return STATUS_LEVEL.DEGRADED;
    }
    return STATUS_LEVEL.HEALTHY;
}

async function runStatusProbePass(options = {}) {
    const tierConfig = options.tierConfig || resolveServiceTierConfig();
    const peerConfig = options.peerConfig || resolveStatusMonitorPeerConfig(tierConfig);
    const catalog = buildComponentCatalog(peerConfig);
    const checkedAt = new Date().toISOString();

    const components = [];
    for (const entry of catalog) {
        const result = await probeHttpTarget(entry.probe);
        components.push({
            id: entry.id,
            label: entry.label,
            group: entry.group,
            description: entry.description,
            status: result.status,
            detail: result.detail,
            latencyMs: result.latencyMs,
            checkedAt
        });
    }

    return {
        checkedAt,
        tier: tierConfig.tier,
        deploy: getDeployStatePayload(),
        overallStatus: summarizeOverallStatus(components),
        components,
        peers: peerConfig
    };
}

function buildAlertKey(snapshot) {
    const bad = (snapshot.components || [])
        .filter((entry) => entry.status !== STATUS_LEVEL.HEALTHY)
        .map((entry) => `${entry.id}:${entry.status}:${entry.detail}`)
        .sort()
        .join('|');
    return `${snapshot.overallStatus}::${bad}`;
}

async function maybeSendStatusAlertEmail(snapshot, tierConfig = resolveServiceTierConfig()) {
    const badComponents = (snapshot.components || []).filter(
        (entry) => entry.status === STATUS_LEVEL.DEGRADED || entry.status === STATUS_LEVEL.CRITICAL
    );

    if (!badComponents.length) {
        lastSnapshotKey = '';
        return { sent: false, reason: 'all-healthy' };
    }

    const alertKey = buildAlertKey(snapshot);
    if (alertKey === lastSnapshotKey) {
        return { sent: false, reason: 'unchanged' };
    }

    const now = Date.now();
    const cooldownKey = snapshot.overallStatus;
    const lastSent = lastAlertSentAtByKey.get(cooldownKey) || 0;
    if (now - lastSent < ALERT_COOLDOWN_MS) {
        return { sent: false, reason: 'cooldown' };
    }

    const result = await sendStatusAlertEmail({
        severity: snapshot.overallStatus === STATUS_LEVEL.CRITICAL ? 'critical' : 'warning',
        checkedAt: snapshot.checkedAt,
        components: badComponents,
        statusPageUrl: `${tierConfig.publicSiteUrl}/status`
    });

    if (result.ok) {
        lastAlertSentAtByKey.set(cooldownKey, now);
        lastSnapshotKey = alertKey;
        return { sent: true };
    }

    return { sent: false, reason: result.error || 'send-failed' };
}

async function tickStatusMonitor(options = {}) {
    const tierConfig = options.tierConfig || resolveServiceTierConfig();
    const snapshot = await runStatusProbePass({
        tierConfig,
        peerConfig: options.peerConfig
    });

    if (options.sendAlerts !== false) {
        await maybeSendStatusAlertEmail(snapshot, tierConfig);
    }

    return snapshot;
}

function startStatusMonitorLoop(options = {}) {
    if (monitorTimer) return monitorTimer;

    const tierConfig = options.tierConfig || resolveServiceTierConfig();
    monitorTimer = setInterval(() => {
        void tickStatusMonitor({ tierConfig, sendAlerts: true }).catch((err) => {
            console.warn('[NEXUS] Status monitor tick failed:', err?.message || err);
        });
    }, MONITOR_INTERVAL_MS);

    if (typeof monitorTimer.unref === 'function') {
        monitorTimer.unref();
    }

    void tickStatusMonitor({ tierConfig, sendAlerts: true }).catch((err) => {
        console.warn('[NEXUS] Status monitor initial tick failed:', err?.message || err);
    });

    return monitorTimer;
}

function stopStatusMonitorLoop() {
    if (!monitorTimer) return;
    clearInterval(monitorTimer);
    monitorTimer = null;
}

function registerStatusRoutes(app, options = {}) {
    const tierConfig = options.tierConfig || resolveServiceTierConfig();

    app.get('/api/status/snapshot', async (_req, res) => {
        try {
            const snapshot = await runStatusProbePass({ tierConfig });
            res.set('Cache-Control', 'no-store');
            res.json({ status: 'ok', snapshot });
        } catch (err) {
            res.status(500).json({
                status: 'error',
                message: err?.message || 'Status snapshot failed.'
            });
        }
    });

    app.get('/api/status/components', (_req, res) => {
        const peerConfig = resolveStatusMonitorPeerConfig(tierConfig);
        res.set('Cache-Control', 'no-store');
        res.json({
            status: 'ok',
            components: buildComponentCatalog(peerConfig)
        });
    });
}

function registerHealthRoutes(app, options = {}) {
    const db = options.db;
    const tierConfig = options.tierConfig || resolveServiceTierConfig();

    app.get('/api/health/live', (_req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({
            status: 'healthy',
            componentStatus: 'healthy',
            tier: tierConfig.tier,
            detail: 'Process is accepting requests.',
            deploy: getDeployStatePayload(),
            checkedAt: new Date().toISOString()
        });
    });

    app.get('/api/health/community-chat', (_req, res) => {
        try {
            const chat = db?.get?.('portal.communityChat')?.value?.();
            const channels = chat?.channels && typeof chat.channels === 'object' ? chat.channels : {};
            const channelCount = Object.keys(channels).length;
            const healthy = channelCount > 0;
            res.set('Cache-Control', 'no-store');
            res.json({
                status: healthy ? 'healthy' : 'degraded',
                componentStatus: healthy ? 'healthy' : 'degraded',
                detail: healthy
                    ? `Community chat ledger online (${channelCount} channels).`
                    : 'Community chat channels are not initialized.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Community chat health check failed.'
            });
        }
    });

    app.get('/api/health/messaging', (_req, res) => {
        try {
            const messages = db?.get?.('mailbox.messages')?.value?.();
            const drafts = db?.get?.('mailbox.drafts')?.value?.();
            const healthy = Array.isArray(messages) && Array.isArray(drafts);
            res.set('Cache-Control', 'no-store');
            res.json({
                status: healthy ? 'healthy' : 'degraded',
                componentStatus: healthy ? 'healthy' : 'degraded',
                detail: healthy
                    ? `Mailbox ledger online (${messages.length} messages, ${drafts.length} drafts).`
                    : 'Mailbox collections are unavailable.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Messaging health check failed.'
            });
        }
    });

    app.get('/api/health/authentication', (_req, res) => {
        try {
            const commanders = db?.get?.('commanders')?.value?.();
            const healthy = Array.isArray(commanders);
            res.set('Cache-Control', 'no-store');
            res.json({
                status: healthy ? 'healthy' : 'degraded',
                componentStatus: healthy ? 'healthy' : 'degraded',
                detail: healthy
                    ? `Authentication ledger online (${commanders.length} commanders).`
                    : 'Commander ledger is unavailable.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Authentication health check failed.'
            });
        }
    });

    app.get('/api/health/game-chat', (_req, res) => {
        try {
            const chat = db?.get?.('portal.gameChat')?.value?.();
            const channels = chat?.channels && typeof chat.channels === 'object' ? chat.channels : {};
            const healthy = Object.keys(channels).length > 0;
            res.set('Cache-Control', 'no-store');
            res.json({
                status: healthy ? 'healthy' : 'degraded',
                componentStatus: healthy ? 'healthy' : 'degraded',
                detail: healthy
                    ? `Game chat ledger online (${Object.keys(channels).length} channels).`
                    : 'Game chat channels are not initialized.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Game chat health check failed.'
            });
        }
    });

    app.get('/api/health/battle-sim', (_req, res) => {
        try {
            const battleSim = require('./nexus-age-battle-sim');
            const canSimulate = typeof battleSim?.simulateTrainingBattle === 'function'
                || typeof battleSim?.executeGuildTrainingBattle === 'function';
            res.set('Cache-Control', 'no-store');
            res.json({
                status: canSimulate ? 'healthy' : 'degraded',
                componentStatus: canSimulate ? 'healthy' : 'degraded',
                detail: canSimulate
                    ? 'Battle simulation module loaded.'
                    : 'Battle simulation module is unavailable.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Battle simulation health check failed.'
            });
        }
    });

    app.get('/api/health/age-movement', (_req, res) => {
        try {
            const movement = db?.get?.('portal.ageMovement')?.value?.();
            const healthy = movement && typeof movement === 'object';
            res.set('Cache-Control', 'no-store');
            res.json({
                status: healthy ? 'healthy' : 'degraded',
                componentStatus: healthy ? 'healthy' : 'degraded',
                detail: healthy
                    ? 'Age movement ledger online.'
                    : 'Age movement ledger has not been initialized.',
                checkedAt: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'critical',
                componentStatus: 'critical',
                detail: err?.message || 'Age movement health check failed.'
            });
        }
    });
}

module.exports = {
    STATUS_LEVEL,
    buildComponentCatalog,
    runStatusProbePass,
    tickStatusMonitor,
    startStatusMonitorLoop,
    stopStatusMonitorLoop,
    registerStatusRoutes,
    registerHealthRoutes
};

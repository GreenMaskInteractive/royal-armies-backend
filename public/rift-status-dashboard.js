/**
 * RIFT — Public operational status dashboard.
 */
(function initStatusDashboard(global) {
    'use strict';

    const REFRESH_INTERVAL_MS = 30000;
    const STATUS_LABELS = {
        healthy: 'Online',
        degraded: 'Hiccups',
        critical: 'Offline'
    };

    let refreshTimer = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatCheckedAt(isoValue) {
        if (!isoValue) return 'Last checked — unknown';
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return 'Last checked — unknown';
        return `Last checked — ${date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        })}`;
    }

    function normalizeStatus(value) {
        const status = String(value || '').trim().toLowerCase();
        if (status === 'degraded' || status === 'warning') return 'degraded';
        if (status === 'critical' || status === 'offline') return 'critical';
        return 'healthy';
    }

    function groupComponents(components) {
        const groups = new Map();
        (Array.isArray(components) ? components : []).forEach((entry) => {
            const groupName = String(entry.group || 'Systems').trim() || 'Systems';
            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName).push(entry);
        });
        return groups;
    }

    function renderComponentRow(entry) {
        const status = normalizeStatus(entry.status);
        const label = STATUS_LABELS[status] || 'Unknown';
        const latency = Number.isFinite(Number(entry.latencyMs))
            ? `${Math.max(0, Math.round(Number(entry.latencyMs)))} ms`
            : '—';

        return `
            <article class="status-dashboard-component status-dashboard-component--${status}">
                <div class="status-dashboard-component-head">
                    <div class="status-dashboard-component-title-wrap">
                        <span class="status-dot status-dot--${status}" aria-hidden="true"></span>
                        <h3 class="status-dashboard-component-title">${escapeHtml(entry.label || entry.id || 'Component')}</h3>
                    </div>
                    <span class="status-dashboard-component-badge status-dashboard-component-badge--${status}">${escapeHtml(label)}</span>
                </div>
                <p class="status-dashboard-component-description">${escapeHtml(entry.description || 'Operational component.')}</p>
                <div class="status-dashboard-component-meta">
                    <span>${escapeHtml(entry.detail || 'No additional detail.')}</span>
                    <span>Probe ${escapeHtml(latency)}</span>
                </div>
            </article>
        `;
    }

    function renderGroups(components) {
        const host = global.document.getElementById('status-dashboard-groups');
        if (!host) return;

        const groups = groupComponents(components);
        if (!groups.size) {
            host.innerHTML = '<div class="status-dashboard-loading">No component data returned.</div>';
            return;
        }

        host.innerHTML = Array.from(groups.entries()).map(([groupName, rows]) => `
            <section class="status-dashboard-group">
                <h2 class="status-dashboard-group-title">${escapeHtml(groupName)}</h2>
                <div class="status-dashboard-component-grid">
                    ${rows.map(renderComponentRow).join('')}
                </div>
            </section>
        `).join('');
    }

    function renderOverall(snapshot) {
        const overall = normalizeStatus(snapshot?.overallStatus);
        const titleEl = global.document.getElementById('status-dashboard-overall-title');
        const detailEl = global.document.getElementById('status-dashboard-overall-detail');
        const checkedEl = global.document.getElementById('status-dashboard-checked-at');
        const cardEl = global.document.getElementById('status-dashboard-overall-card');
        const indicatorEl = global.document.getElementById('status-dashboard-overall-indicator');

        const titleMap = {
            healthy: 'All monitored systems are online',
            degraded: 'Some systems are experiencing hiccups',
            critical: 'One or more systems are offline'
        };

        const detailMap = {
            healthy: 'Portal, messaging, chat, and game services responded successfully to live probes.',
            degraded: 'Some components reported degraded health. Staff have been notified by email.',
            critical: 'Critical components are offline. Staff have been notified by email with incident detail.'
        };

        if (titleEl) titleEl.textContent = titleMap[overall] || 'Status unknown';
        if (detailEl) detailEl.textContent = detailMap[overall] || 'Status detail unavailable.';
        if (checkedEl) checkedEl.textContent = formatCheckedAt(snapshot?.checkedAt);

        if (cardEl) {
            cardEl.classList.remove(
                'status-dashboard-overall-card--healthy',
                'status-dashboard-overall-card--degraded',
                'status-dashboard-overall-card--critical',
                'status-dashboard-overall-card--loading'
            );
            cardEl.classList.add(`status-dashboard-overall-card--${overall}`);
        }

        if (indicatorEl) {
            indicatorEl.classList.remove(
                'status-dot--healthy',
                'status-dot--degraded',
                'status-dot--critical'
            );
            indicatorEl.classList.add('status-dot', `status-dot--${overall}`);
        }
    }

    async function fetchSnapshot() {
        const response = await global.fetch(resolveApiUrl('/api/status/snapshot'), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Status snapshot failed (${response.status})`);
        }

        const payload = await response.json();
        if (payload?.status !== 'ok' || !payload.snapshot) {
            throw new Error('Status snapshot payload invalid.');
        }

        return payload.snapshot;
    }

    async function refreshDashboard() {
        const groupsHost = global.document.getElementById('status-dashboard-groups');
        try {
            const snapshot = await fetchSnapshot();
            renderOverall(snapshot);
            renderGroups(snapshot.components || []);
        } catch (err) {
            renderOverall({
                overallStatus: 'critical',
                checkedAt: new Date().toISOString()
            });

            if (groupsHost) {
                groupsHost.innerHTML = `
                    <div class="status-dashboard-error">
                        Unable to load live status data: ${escapeHtml(err?.message || 'Unknown error')}.
                    </div>
                `;
            }
        }
    }

    function scheduleRefreshLoop() {
        if (refreshTimer) {
            global.clearInterval(refreshTimer);
        }
        refreshTimer = global.setInterval(() => {
            void refreshDashboard();
        }, REFRESH_INTERVAL_MS);
    }

    function bindControls() {
        const refreshBtn = global.document.getElementById('status-dashboard-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                void refreshDashboard();
            });
        }
    }

    function init() {
        bindControls();
        void refreshDashboard();
        scheduleRefreshLoop();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);

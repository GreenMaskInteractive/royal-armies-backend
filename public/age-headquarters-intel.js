/**
 * RIFT — Headquarters intel panels (threat matrix, spy logs, nation bounties).
 */
(function initAgeHeadquartersIntel(global) {
    'use strict';

    const HOSTILITY_LABELS = {
        at_war: 'At War',
        hostile: 'Hostile',
        allied: 'Allied',
        neutral: 'Neutral',
        unknown: 'Unknown'
    };

    let lastWorkspace = null;
    let lastAllies = [];
    let activeSpyLogId = '';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        if (typeof global.resolveActiveCommanderUsername === 'function') {
            return global.resolveActiveCommanderUsername() || '';
        }
        try {
            return String(global.localStorage.getItem('activeCommanderUser') || '').trim();
        } catch (_err) {
            return '';
        }
    }

    async function patchHeadquarters(body) {
        const username = resolveUsername();
        if (!username) return null;

        const response = await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ...body })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = payload?.message || payload?.code || `headquarters patch ${response.status}`;
            throw new Error(message);
        }
        return payload?.workspace || null;
    }

    function formatNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '—';
        return numeric.toLocaleString();
    }

    function renderThreatMatrix(rows) {
        const host = global.document.getElementById('age-hq-threat-matrix');
        if (!host) return;

        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) {
            host.innerHTML = '<p class="age-hq-intel-empty">No bordering nations detected on the current map.</p>';
            return;
        }

        host.innerHTML = list.map((row) => {
            const hostility = String(row.hostility || 'unknown').toLowerCase();
            const hostilityClass = `age-hq-threat-row__hostility age-hq-threat-row__hostility--${hostility}`;
            return (
                `<div class="age-hq-threat-row">`
                + `<span class="age-hq-threat-row__nation">${escapeHtml(row.nationName)}</span>`
                + `<span class="age-hq-threat-row__power" title="Military power">${formatNumber(row.militaryPower)}</span>`
                + `<span class="${hostilityClass}">${escapeHtml(HOSTILITY_LABELS[hostility] || hostility)}</span>`
                + `<span class="age-hq-threat-row__distance">${formatNumber(row.borderDistance)}</span>`
                + `</div>`
            );
        }).join('');
    }

    function findSpyLog(logId) {
        const logs = Array.isArray(lastWorkspace?.spyLogs) ? lastWorkspace.spyLogs : [];
        return logs.find((entry) => entry.id === logId) || null;
    }

    function setSpyDetailPanelVisible(panel, visible) {
        if (!panel) return;
        panel.hidden = !visible;
        if (visible) {
            panel.removeAttribute('hidden');
        } else {
            panel.setAttribute('hidden', '');
        }
    }

    function openSpyDetail(log) {
        const panel = global.document.getElementById('age-hq-spy-detail');
        const body = global.document.getElementById('age-hq-spy-detail-body');
        const title = global.document.getElementById('age-hq-spy-detail-title');
        if (!panel || !body || !log) return;

        activeSpyLogId = log.id;
        if (title) {
            title.textContent = `Spy Report — ${log.subjectUsername}`;
        }

        body.innerHTML = (
            '<dl>'
            + `<div><dt>Target</dt><dd>${escapeHtml(log.subjectUsername)} (${escapeHtml(log.subjectNationName)})</dd></div>`
            + `<div><dt>Location</dt><dd>${escapeHtml(log.cityName || log.cityId || 'Unknown city')}</dd></div>`
            + `<div><dt>Power at capture</dt><dd>${formatNumber(log.snapshotPower)}</dd></div>`
            + `<div><dt>Current power</dt><dd>${formatNumber(log.currentPower)} (${formatNumber(log.growthPercent)}% change)</dd></div>`
            + `<div><dt>Units observed</dt><dd>${formatNumber(log.armySummary?.unitCount)} units · ${formatNumber(log.armySummary?.stackCount)} stacks · Rank ${formatNumber(log.armySummary?.rank)}</dd></div>`
            + `<div><dt>Captured</dt><dd>${escapeHtml(new Date(log.createdAt).toLocaleString())}</dd></div>`
            + '</dl>'
        );
        setSpyDetailPanelVisible(panel, true);
        renderSpyLogs(lastWorkspace?.spyLogs, { skipClose: true });
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function closeSpyDetail(options = {}) {
        const panel = global.document.getElementById('age-hq-spy-detail');
        activeSpyLogId = '';
        setSpyDetailPanelVisible(panel, false);
        if (!options.skipRender) {
            renderSpyLogs(lastWorkspace?.spyLogs, { skipClose: true });
        }
    }

    function renderSpyLogs(logs, options = {}) {
        const listEl = global.document.getElementById('age-hq-spy-log-list');
        const emptyEl = global.document.getElementById('age-hq-spy-log-empty');
        if (!listEl) return;

        const rows = Array.isArray(logs) ? logs : [];
        if (emptyEl) emptyEl.hidden = rows.length > 0;
        if (!rows.length) {
            listEl.innerHTML = '';
            if (!options.skipClose) {
                closeSpyDetail({ skipRender: true });
            } else {
                const panel = global.document.getElementById('age-hq-spy-detail');
                setSpyDetailPanelVisible(panel, false);
            }
            return;
        }

        if (!options.skipClose && activeSpyLogId && !rows.some((log) => log.id === activeSpyLogId)) {
            closeSpyDetail({ skipRender: true });
        }

        const allyOptions = lastAllies
            .map((row) => `<option value="${escapeHtml(row.nationId)}">${escapeHtml(row.name)}</option>`)
            .join('');

        listEl.innerHTML = rows.map((log) => {
            const outdated = Boolean(log.outdated);
            const stamp = outdated ? '<span class="age-hq-spy-log-btn__stamp" aria-hidden="true">OUTDATED</span>' : '';
            const reviewBtn = outdated
                ? ''
                : `<button type="button" class="age-hq-spy-log-mini-btn" data-hq-spy-review="${escapeHtml(log.id)}">Review</button>`;
            const forwardSelect = outdated || !allyOptions
                ? ''
                : (
                    `<select class="age-hq-spy-forward-select" data-hq-spy-forward-select="${escapeHtml(log.id)}" aria-label="Forward to ally">`
                    + '<option value="">Forward…</option>'
                    + allyOptions
                    + '</select>'
                );
            const selected = log.id === activeSpyLogId;
            return (
                `<div class="age-hq-spy-log-btn${outdated ? ' is-outdated' : ''}${selected ? ' is-selected' : ''}" data-hq-spy-id="${escapeHtml(log.id)}">`
                + `<span class="age-hq-spy-log-btn__copy"><strong>${escapeHtml(log.subjectUsername)}</strong> · ${escapeHtml(log.subjectNationName)} · Power ${formatNumber(log.snapshotPower)}</span>`
                + `<span class="age-hq-spy-log-btn__actions">${reviewBtn}<button type="button" class="age-hq-spy-log-mini-btn" data-hq-spy-delete="${escapeHtml(log.id)}">Delete</button>${forwardSelect}</span>`
                + stamp
                + `</div>`
            );
        }).join('');
    }

    function renderBounties(slice) {
        const targetsEl = global.document.getElementById('age-hq-bounty-targets');
        const feedEl = global.document.getElementById('age-hq-bounty-feed');
        const metaEl = global.document.getElementById('age-hq-bounty-meta');
        if (!targetsEl || !feedEl) return;

        const data = slice && typeof slice === 'object' ? slice : {};
        if (metaEl) {
            metaEl.textContent = `Live feed · ${formatNumber(data.hoursRemaining)}h remaining in this cycle`;
        }

        const targets = Array.isArray(data.targets) ? data.targets : [];
        targetsEl.innerHTML = targets.length
            ? targets.map((row) => (
                `<div class="age-hq-bounty-target-row${row.highlightNation ? ' is-nation-highlight' : ''}${row.resolved ? ' is-resolved' : ''}">`
                + `<strong>${escapeHtml(row.targetUsername)}</strong> · Rank ${formatNumber(row.targetRank)} · ${escapeHtml(row.nationName)}`
                + `${row.resolved ? ` · ${escapeHtml(row.resolution || 'resolved')}` : ''}`
                + `</div>`
            )).join('')
            : '<p class="age-hq-intel-empty">No active bounty targets this cycle.</p>';

        const feed = Array.isArray(data.feed) ? data.feed : [];
        feedEl.innerHTML = feed.length
            ? feed.map((entry) => (
                `<article class="age-hq-bounty-feed-item${entry.highlightNation ? ' is-nation-highlight' : ''}">`
                + `<span class="age-hq-bounty-feed-item__type">${escapeHtml(entry.type)}</span>`
                + `<span>${escapeHtml(entry.message)}</span>`
                + `</article>`
            )).join('')
            : '';
    }

    function applyWorkspace(workspace) {
        lastWorkspace = workspace || null;
        const diplomacy = workspace?.diplomacyPublic || {};
        lastAllies = Array.isArray(diplomacy.allies) ? diplomacy.allies : [];

        renderThreatMatrix(workspace?.threatMatrix);
        renderSpyLogs(workspace?.spyLogs);
        renderBounties(workspace?.hqBounties);
    }

    async function handleSpyLogListClick(event) {
        const reviewBtn = event.target.closest('[data-hq-spy-review]');
        if (reviewBtn) {
            event.preventDefault();
            event.stopPropagation();
            openSpyDetail(findSpyLog(reviewBtn.getAttribute('data-hq-spy-review')));
            return;
        }

        const deleteBtn = event.target.closest('[data-hq-spy-delete]');
        if (deleteBtn) {
            event.preventDefault();
            event.stopPropagation();
            try {
                const workspace = await patchHeadquarters({ deleteSpyLogId: deleteBtn.getAttribute('data-hq-spy-delete') });
                if (workspace) {
                    global.RoyalArmiesAgeHeadquarters?.applyWorkspace?.(workspace, {
                        silent: true,
                        mergeWithPrevious: true
                    });
                }
            } catch (err) {
                console.warn('[RIFT] Spy log delete failed:', err);
            }
            return;
        }

        const forwardSelect = event.target.closest('[data-hq-spy-forward-select]');
        if (forwardSelect && forwardSelect.value) {
            const logId = forwardSelect.getAttribute('data-hq-spy-forward-select');
            const nationId = forwardSelect.value;
            try {
                const workspace = await patchHeadquarters({
                    forwardSpyLogId: logId,
                    forwardSpyNationId: nationId
                });
                if (workspace) {
                    global.RoyalArmiesAgeHeadquarters?.applyWorkspace?.(workspace, {
                        silent: true,
                        mergeWithPrevious: true
                    });
                }
            } catch (err) {
                console.warn('[RIFT] Spy log forward failed:', err);
            }
            forwardSelect.value = '';
        }
    }

    function bindEvents() {
        const listEl = global.document.getElementById('age-hq-spy-log-list');
        if (listEl && listEl.dataset.hqIntelBound !== '1') {
            listEl.dataset.hqIntelBound = '1';
            listEl.addEventListener('click', handleSpyLogListClick);
            listEl.addEventListener('change', handleSpyLogListClick);
        }

        const closeBtn = global.document.getElementById('age-hq-spy-detail-close');
        if (closeBtn && closeBtn.dataset.hqIntelBound !== '1') {
            closeBtn.dataset.hqIntelBound = '1';
            closeBtn.addEventListener('click', closeSpyDetail);
        }
    }

    bindEvents();

    global.RoyalArmiesAgeHeadquartersIntel = {
        applyWorkspace,
        closeSpyDetail
    };
})(typeof window !== 'undefined' ? window : global);

/**
 * RIFT — Watchtower border intel workspace (city garrison spy, compiler, player scout/seize).
 */
(function initRoyalArmiesAgeWatchtower(global) {
    'use strict';

    let bound = false;
    let activeCityId = '';
    let workspace = null;
    let actionInFlight = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatCommanderRankLabel(rank, options = {}) {
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const path = options.path ?? 'PHYS';
        const rankTitleGender = options.rankTitleGender;
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(rank, path, rankTitleGender);
        }
        if (rankTitles?.getCommanderRankDisplayTitle) {
            const title = rankTitles.getCommanderRankDisplayTitle(rank, path, rankTitleGender);
            if (title) return title;
        }
        return `Rank ${formatNumber(rank)}`;
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

    function getWorkspaceEl() {
        return global.document.getElementById('age-watchtower-workspace');
    }

    function setOpen(isOpen) {
        const root = getWorkspaceEl();
        if (!root) return;
        root.hidden = !isOpen;
        root.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        global.document.body.classList.toggle('age-watchtower-open', isOpen);
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
    }

    function formatNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '—';
        return numeric.toLocaleString();
    }

    function formatAccuracy(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '—';
        return `${Math.round(numeric * 100)}% est.`;
    }

    function renderSectionRows(sections) {
        if (!sections || typeof sections !== 'object') {
            return '<p class="age-watchtower-empty">No garrison estimate filed yet.</p>';
        }

        const blocks = [];
        Object.keys(sections).forEach((key) => {
            const section = sections[key];
            if (!section || typeof section !== 'object') return;

            if (Array.isArray(section.units)) {
                section.units.forEach((unit) => {
                    blocks.push(
                        `<div class="age-watchtower-report-row">`
                        + `<dt>${escapeHtml(unit.unitName)}</dt>`
                        + `<dd>~${formatNumber(unit.estimatedQty)} · tier ~${escapeHtml(unit.estimatedAvgTier)}</dd>`
                        + `</div>`
                    );
                });
                return;
            }

            const rows = [];
            if (section.estimatedCount != null) {
                rows.push(`<div class="age-watchtower-report-row"><dt>Commanders</dt><dd>~${formatNumber(section.estimatedCount)}</dd></div>`);
            }
            if (section.estimatedUnits != null) {
                rows.push(`<div class="age-watchtower-report-row"><dt>Units</dt><dd>~${formatNumber(section.estimatedUnits)}</dd></div>`);
            }
            if (section.estimatedHp != null) {
                rows.push(`<div class="age-watchtower-report-row"><dt>Strength (HP)</dt><dd>~${formatNumber(section.estimatedHp)}</dd></div>`);
            }
            if (rows.length) {
                blocks.push(`<p class="age-watchtower-copy"><strong>${escapeHtml(section.label || key)}</strong></p>${rows.join('')}`);
            }
        });

        return blocks.length
            ? `<div class="age-watchtower-report-grid">${blocks.join('')}</div>`
            : '<p class="age-watchtower-empty">No garrison estimate filed yet.</p>';
    }

    function renderGarrisonPanel(data) {
        const estimate = data?.garrisonEstimate;
        const compiled = data?.compiledGarrisonReport;
        const fragments = Array.isArray(data?.garrisonFragments) ? data.garrisonFragments : [];
        const accuracyLabel = estimate
            ? formatAccuracy(estimate.accuracy || compiled?.accuracy)
            : '';
        const partialNote = estimate?.partial
            ? ' Partial fragment — compile allied reports for a closer estimate.'
            : (compiled ? ' Compiled allied garrison report.' : '');

        const fragmentList = fragments.length
            ? fragments.map((fragment) => (
                `<div class="age-watchtower-fragment-item">`
                + `${escapeHtml(fragment.createdBy)} · ${escapeHtml((fragment.data?.sectionKeys || [fragment.sectionKey]).join(', '))}`
                + ` · ${formatAccuracy(fragment.accuracy)}`
                + `</div>`
            )).join('')
            : '<p class="age-watchtower-empty">No allied fragments uploaded yet.</p>';

        return (
            `<section class="age-watchtower-section">`
            + `<h3 class="age-watchtower-section-title">City Garrison Spy Report`
            + (accuracyLabel ? `<span class="age-watchtower-accuracy">${escapeHtml(accuracyLabel)}</span>` : '')
            + `</h3>`
            + `<p class="age-watchtower-copy">Team intel on garrisoned players and NPC defenders. Each commander may spy once; upload fragments to the compiler for a closer estimate.${escapeHtml(partialNote)}</p>`
            + renderSectionRows(estimate?.sections || compiled?.sections)
            + `<div class="age-watchtower-actions">`
            + `<button type="button" class="age-watchtower-btn age-watchtower-btn--primary" data-watchtower-action="garrison-spy" ${data?.canGarrisonSpy ? '' : 'disabled'}>`
            + `${data?.canGarrisonSpy ? 'Spy City Garrison' : 'Garrison Spied'}`
            + `</button>`
            + `<button type="button" class="age-watchtower-btn" data-watchtower-action="compile-garrison" ${data?.compilerReady ? '' : 'disabled'}>`
            + `Compile Report (${formatNumber(data?.fragmentCount || 0)} frags)`
            + `</button>`
            + `</div>`
            + `<h4 class="age-watchtower-section-title">Nation Fragments</h4>`
            + `<div class="age-watchtower-fragment-list">${fragmentList}</div>`
            + `</section>`
        );
    }

    function renderPlayerScoutMarkup(report) {
        if (!report?.estimate) return '';
        const estimate = report.estimate;
        const stacks = Array.isArray(estimate.estimatedStacks) ? estimate.estimatedStacks : [];
        const stackLines = stacks.map((row) => (
            `${escapeHtml(row.unitName)}: ~${formatNumber(row.estimatedQty)} (tier ~${escapeHtml(row.estimatedAvgTier)})`
        )).join(' · ');
        return (
            `<div class="age-watchtower-player-scout">`
            + `Scout estimate — ~${formatNumber(estimate.estimatedUnits)} units, power ~${formatNumber(estimate.estimatedPower)} `
            + `(${formatAccuracy(report.accuracy)}). `
            + (stackLines ? `${stackLines}. ` : '')
            + `${escapeHtml(estimate.note || '')}`
            + `</div>`
        );
    }

    function renderPlayersPanel(data) {
        const players = Array.isArray(data?.players) ? data.players : [];
        const cost = formatNumber(data?.scoutGoldCost || 150);

        if (!players.length) {
            return (
                `<section class="age-watchtower-section">`
                + `<h3 class="age-watchtower-section-title">Border Commanders</h3>`
                + `<p class="age-watchtower-empty">No foreign commanders are currently stationed in this city.</p>`
                + `</section>`
            );
        }

        const rows = players.map((player) => {
            const meta = [
                player.nationId ? escapeHtml(player.nationId) : '',
                player.rank ? formatCommanderRankLabel(player.rank, player) : '',
                player.online ? 'Online' : 'Offline'
            ].filter(Boolean).join(' · ');

            return (
                `<div class="age-watchtower-player-row" data-watchtower-player="${escapeHtml(player.username)}">`
                + `<div>`
                + `<span class="age-watchtower-player-name">${escapeHtml(player.displayName || player.username)}</span>`
                + `<span class="age-watchtower-player-meta">${meta}</span>`
                + `${renderPlayerScoutMarkup(player.scoutReport)}`
                + `</div>`
                + `<button type="button" class="age-watchtower-btn age-watchtower-btn--scout" data-watchtower-action="scout-player" data-target-username="${escapeHtml(player.username)}" ${player.canScout ? '' : 'disabled'}>Scout (${cost}g)</button>`
                + `<button type="button" class="age-watchtower-btn age-watchtower-btn--seize" data-watchtower-action="seize" data-target-username="${escapeHtml(player.username)}" ${player.canSeize ? '' : 'disabled'}>Seize</button>`
                + `</div>`
            );
        }).join('');

        return (
            `<section class="age-watchtower-section">`
            + `<h3 class="age-watchtower-section-title">Border Commanders</h3>`
            + `<p class="age-watchtower-copy">Allied, NAP, neutral, and enemy commanders only — your nation is excluded. Scout raids cost ${cost} gold each. Seize launches border PvP against hostile commanders (1 Move).</p>`
            + `<div class="age-watchtower-player-list">${rows}</div>`
            + `</section>`
        );
    }

    function renderWorkspace(data) {
        const body = global.document.getElementById('age-watchtower-body');
        const title = global.document.getElementById('age-watchtower-city-title');
        const subtitle = global.document.getElementById('age-watchtower-city-subtitle');
        const wallet = global.document.getElementById('age-watchtower-gold');
        if (!body || !data) return;

        if (title) title.textContent = data.cityName || 'Border City';
        if (subtitle) {
            subtitle.textContent = `${data.nationName || 'Foreign holdings'} · ${String(data.relationship || 'border').toUpperCase()} border`;
        }
        if (wallet) wallet.textContent = `${formatNumber(data.viewerGold)} gold`;

        body.innerHTML = (
            `<div class="age-watchtower-layout">`
            + `<div class="age-watchtower-panel">${renderGarrisonPanel(data)}</div>`
            + `<div class="age-watchtower-panel">${renderPlayersPanel(data)}</div>`
            + `</div>`
        );
    }

    function showMessage(text, tone = 'success') {
        const host = global.document.getElementById('age-watchtower-message');
        if (!host) return;
        if (!text) {
            host.hidden = true;
            host.textContent = '';
            host.className = 'age-watchtower-message';
            return;
        }
        host.hidden = false;
        host.className = `age-watchtower-message is-${tone}`;
        host.textContent = text;
    }

    async function fetchWorkspace(cityId) {
        const username = resolveUsername();
        if (!username || !cityId) throw new Error('Sign in as a commander to open the Watchtower.');

        const query = new URLSearchParams({ username, cityId: String(cityId) });
        const response = await global.fetch(resolveApiUrl(`/api/portal/age/watchtower?${query.toString()}`), {
            credentials: 'same-origin'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || payload?.code || `Watchtower failed (${response.status})`);
        }
        return payload.workspace || null;
    }

    async function postAction(path, body) {
        const username = resolveUsername();
        if (!username) throw new Error('Sign in as a commander to use the Watchtower.');

        const response = await global.fetch(resolveApiUrl(path), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username, ...body })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || payload?.code || `Watchtower action failed (${response.status})`);
        }
        return payload;
    }

    async function refreshWorkspace() {
        if (!activeCityId) return;
        workspace = await fetchWorkspace(activeCityId);
        renderWorkspace(workspace);
    }

    async function open(cityId, cityName) {
        const root = getWorkspaceEl();
        if (!root) return;

        activeCityId = String(cityId || '').trim();
        showMessage('');
        setOpen(true);

        const title = global.document.getElementById('age-watchtower-city-title');
        if (title && cityName) title.textContent = cityName;

        try {
            workspace = await fetchWorkspace(activeCityId);
            renderWorkspace(workspace);
        } catch (err) {
            showMessage(String(err?.message || 'Could not open Watchtower.'), 'error');
        }
    }

    function close() {
        activeCityId = '';
        workspace = null;
        actionInFlight = false;
        showMessage('');
        setOpen(false);
    }

    async function handleAction(action, targetUsername) {
        if (!activeCityId || actionInFlight) return;
        actionInFlight = true;
        showMessage('');

        try {
            let payload;
            if (action === 'garrison-spy') {
                payload = await postAction('/api/portal/age/watchtower/garrison-spy', { cityId: activeCityId });
                showMessage('Garrison spy fragment uploaded to the nation compiler.', 'success');
            } else if (action === 'compile-garrison') {
                payload = await postAction('/api/portal/age/watchtower/compile-garrison', { cityId: activeCityId });
                showMessage('Compiled garrison report ready — closer estimate from allied fragments.', 'success');
            } else if (action === 'scout-player') {
                payload = await postAction('/api/portal/age/watchtower/scout-player', {
                    cityId: activeCityId,
                    targetUsername
                });
                showMessage(`Scout raid filed on ${targetUsername}.`, 'success');
            } else if (action === 'seize') {
                const confirmed = await global.showPortalConfirm?.(
                    `Launch border PvP against ${targetUsername}? This spends 1 Move and may injure your army.`,
                    {
                        title: 'Seize Commander',
                        confirmLabel: 'Seize',
                        cancelLabel: 'Cancel'
                    }
                );
                if (!confirmed) return;

                payload = await postAction('/api/portal/age/watchtower/seize', {
                    cityId: activeCityId,
                    targetUsername
                });
                const won = Boolean(payload?.battle?.attackerWon);
                if (payload?.battleReport) {
                    global.RoyalArmiesAgeBattleReport?.show?.(payload.battleReport);
                }
                showMessage(
                    won
                        ? `Seize victorious against ${targetUsername}.`
                        : `Seize repelled by ${targetUsername}.`,
                    won ? 'success' : 'error'
                );
            } else {
                return;
            }

            if (payload?.workspace) {
                workspace = payload.workspace;
                renderWorkspace(workspace);
            } else {
                await refreshWorkspace();
            }

            if (payload?.ageGold != null) {
                const wallet = global.document.getElementById('age-watchtower-gold');
                if (wallet) wallet.textContent = `${formatNumber(payload.ageGold)} gold`;
                const hudGold = global.document.getElementById('age-hud-gold');
                if (hudGold) hudGold.textContent = formatNumber(payload.ageGold);
            }

            if (payload?.movePoints != null) {
                global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated', {
                    detail: { eventSource: 'watchtower', movePoints: payload.movePoints }
                }));
            }
        } catch (err) {
            showMessage(String(err?.message || 'Watchtower action failed.'), 'error');
        } finally {
            actionInFlight = false;
        }
    }

    function bindEvents() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-watchtower-close')?.addEventListener('click', (event) => {
            event.preventDefault();
            close();
        });

        getWorkspaceEl()?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-watchtower-action]');
            if (!button || button.disabled) return;
            event.preventDefault();
            const action = button.getAttribute('data-watchtower-action');
            const targetUsername = button.getAttribute('data-target-username') || '';
            void handleAction(action, targetUsername);
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const root = getWorkspaceEl();
            if (root && !root.hidden) close();
        });
    }

    function enable() {
        bindEvents();
    }

    global.RoyalArmiesAgeWatchtower = Object.freeze({
        enable,
        open,
        close,
        refresh: refreshWorkspace
    });
})(typeof window !== 'undefined' ? window : globalThis);

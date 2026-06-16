/**
 * RIFT — Post-battle report popup (city assault, border PvP, army group attacks).
 */
(function initRoyalArmiesAgeBattleReport(global) {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatSigned(value) {
        const amount = Math.floor(Number(value) || 0);
        if (amount > 0) return `+${amount}`;
        if (amount < 0) return `${amount}`;
        return '0';
    }

    function formatCommanderStatus(line) {
        const status = String(line?.commanderStatus || '').trim().toLowerCase();
        if (status === 'killed') return 'Slain';
        if (status === 'injured') return 'Wounded';
        if (status === 'captured') return 'Captured';
        return 'Active';
    }

    function renderUnitTable(side) {
        const lines = Array.isArray(side?.unitLines) ? side.unitLines : [];
        if (!lines.length) {
            return '<p class="age-battle-report-empty-side">No unit data recorded for this side.</p>';
        }

        const rows = lines.map((line) => {
            const isCommander = Boolean(line.isCommander);
            const rowClass = isCommander ? ' age-battle-report-unit-row--commander' : '';
            const nameCell = isCommander
                ? `<span class="age-battle-report-commander-badge">Commander</span> ${escapeHtml(line.name)}`
                : escapeHtml(line.name);
            const classLabel = isCommander ? 'Commander' : (line.class || '—');
            return (
                '<tr class="age-battle-report-unit-row' + rowClass + '">'
                + `<td class="age-battle-report-unit-name">${nameCell}</td>`
                + `<td class="age-battle-report-unit-class">${escapeHtml(classLabel)}</td>`
                + `<td class="age-battle-report-unit-count">${escapeHtml(line.count)}</td>`
                + `<td class="age-battle-report-unit-stat">${escapeHtml(line.injured || 0)}</td>`
                + `<td class="age-battle-report-unit-stat">${escapeHtml(line.dead || 0)}</td>`
                + `<td class="age-battle-report-unit-stat">${escapeHtml(line.captured || 0)}</td>`
                + `<td class="age-battle-report-unit-stat">${escapeHtml(line.remaining || 0)}</td>`
                + '</tr>'
            );
        }).join('');

        const commanderNotes = lines
            .filter((line) => line.isCommander && line.commanderNote)
            .map((line) => (
                `<p class="age-battle-report-commander-note age-battle-report-commander-note--${escapeHtml(line.commanderStatus || 'survived')}">`
                + `<strong>${escapeHtml(formatCommanderStatus(line))}:</strong> ${escapeHtml(line.commanderNote)}`
                + (line.commanderKillChance != null && line.commanderStatus !== 'killed'
                    ? ` <span class="age-battle-report-kill-pressure">(kill pressure ~${escapeHtml(line.commanderKillChance)}%)</span>`
                    : '')
                + '</p>'
            ))
            .join('');

        const totals = side.totals || {};

        return (
            '<div class="age-battle-report-side">'
            + `<h3 class="age-battle-report-side-title">${escapeHtml(side.label || 'Force')}</h3>`
            + '<table class="age-battle-report-unit-table">'
            + '<thead><tr>'
            + '<th>Unit</th><th>Class</th><th>Started</th><th>Injured</th><th>Dead</th><th>Captured</th><th>Remaining</th>'
            + '</tr></thead>'
            + `<tbody>${rows}</tbody>`
            + '<tfoot><tr>'
            + '<td colspan="2">Totals</td>'
            + `<td>${escapeHtml(totals.count || 0)}</td>`
            + `<td>${escapeHtml(totals.injured || 0)}</td>`
            + `<td>${escapeHtml(totals.dead || 0)}</td>`
            + `<td>${escapeHtml(totals.captured || 0)}</td>`
            + `<td>${escapeHtml(totals.remaining || 0)}</td>`
            + '</tr></tfoot>'
            + '</table>'
            + (commanderNotes ? `<div class="age-battle-report-commander-notes">${commanderNotes}</div>` : '')
            + '</div>'
        );
    }

    function renderCommanderKills(report) {
        const kills = Array.isArray(report.commanderKills) ? report.commanderKills : [];
        if (!kills.length) return '';

        return (
            '<section class="age-battle-report-section age-battle-report-section--commander-kills">'
            + '<h3 class="age-battle-report-section-title">Commander casualties</h3>'
            + '<ul class="age-battle-report-kill-list">'
            + kills.map((entry) => (
                `<li><strong>${escapeHtml(entry.name || entry.username)}</strong> was slain in PvP.</li>`
            )).join('')
            + '</ul>'
            + '</section>'
        );
    }

    function renderPromotions(report) {
        const rankPromotions = Array.isArray(report.rankPromotions) ? report.rankPromotions : [];
        const unitPromotions = Array.isArray(report.unitPromotions) ? report.unitPromotions : [];
        if (!report.rankPromoted && !rankPromotions.length && !unitPromotions.length) return '';

        const rankLines = rankPromotions.map((entry) => (
            `<li>${escapeHtml(entry?.title || entry?.label || 'Commander rank promotion')}</li>`
        )).join('');

        const unitLines = unitPromotions.map((entry) => (
            `<li>${escapeHtml(entry?.name || 'Unit')} → ${escapeHtml(entry?.nextPromotionLabel || entry?.promotionLabel || 'next rank')}</li>`
        )).join('');

        return (
            '<section class="age-battle-report-section">'
            + '<h3 class="age-battle-report-section-title">Promotions</h3>'
            + (report.rankPromoted
                ? '<p class="age-battle-report-promoted-note">Your commander rank increased.</p>'
                : '')
            + (rankLines ? `<ul class="age-battle-report-promotion-list">${rankLines}</ul>` : '')
            + (unitLines ? `<ul class="age-battle-report-promotion-list">${unitLines}</ul>` : '')
            + '</section>'
        );
    }

    function renderRewards(report) {
        const rows = [];
        if (report.xpGain) rows.push(['Guild XP', formatSigned(report.xpGain)]);
        if (report.goldGain) rows.push(['Gold gained', formatSigned(report.goldGain)]);
        if (report.goldLoss) rows.push(['Gold lost', formatSigned(-report.goldLoss)]);
        if (report.provisionsGranted) rows.push(['Provisions', formatSigned(report.provisionsGranted)]);
        if (report.captureTreasuryRsd) rows.push(['Nation treasury (RSD)', formatSigned(report.captureTreasuryRsd)]);

        if (!rows.length) return '';

        return (
            '<section class="age-battle-report-section">'
            + '<h3 class="age-battle-report-section-title">Rewards &amp; losses</h3>'
            + '<ul class="age-battle-report-reward-list">'
            + rows.map(([label, value]) => (
                `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`
            )).join('')
            + '</ul>'
            + '</section>'
        );
    }

    function buildReportMarkup(report) {
        const opponent = report.opponentName
            ? `<p class="age-battle-report-opponent">Opponent: ${escapeHtml(report.opponentName)}</p>`
            : '';
        const location = report.locationName
            ? `<p class="age-battle-report-location">${escapeHtml(report.locationName)}</p>`
            : '';

        return (
            '<div class="age-battle-report-shell">'
            + `<p class="age-battle-report-outcome age-battle-report-outcome--${escapeHtml(String(report.winner || 'even').toLowerCase())}">${escapeHtml(report.winnerLabel || 'Battle resolved')}</p>`
            + (report.outcomeLabel ? `<p class="age-battle-report-detail">${escapeHtml(report.outcomeLabel)}</p>` : '')
            + location
            + opponent
            + renderRewards(report)
            + renderCommanderKills(report)
            + renderUnitTable(report.attacker)
            + renderUnitTable(report.defender)
            + renderPromotions(report)
            + '</div>'
        );
    }

    function getModalElements() {
        return {
            modal: global.document.getElementById('age-world-battle-report-modal'),
            body: global.document.getElementById('age-world-battle-report-body'),
            title: global.document.getElementById('age-world-battle-report-title'),
            backdrop: global.document.getElementById('age-world-battle-report-backdrop'),
            closeBtn: global.document.getElementById('age-world-battle-report-close')
        };
    }

    function close() {
        const { modal } = getModalElements();
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
    }

    function show(report) {
        if (!report || typeof report !== 'object') return;

        const { modal, body, title } = getModalElements();
        if (!modal || !body) return;

        if (title) {
            title.textContent = String(report.title || 'Battle Report').trim();
        }

        body.innerHTML = buildReportMarkup(report);
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.requestAnimationFrame(() => {
            getModalElements().closeBtn?.focus?.();
        });
    }

    global.RoyalArmiesAgeBattleReport = {
        show,
        close
    };
})(window);

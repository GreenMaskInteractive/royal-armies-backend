/**
 * RIFT — Age Records rankings (Personal, National, Global) opened from the bottom bar.
 */
(function initAgeRecords(global) {
    'use strict';

    const PLACEHOLDER = '—';
    const RECORDS_EMPTY = '';
    const VALID_TABS = new Set(['personal', 'national', 'global']);

    const GLOBAL_COLUMNS = [
        { key: 'playerName', label: 'Player Name', kind: 'text', alwaysShow: true },
        { key: 'globalRanking', label: 'Global Ranking', kind: 'ranking', alwaysShow: true },
        { key: 'commanderRankTitle', label: 'Commander', kind: 'text' },
        { key: 'nationName', label: 'Nation', kind: 'text' },
        { key: 'sfParticipations', label: 'Strike Force', kind: 'number' },
        { key: 'overallPvpScore', label: 'PvP Score', kind: 'number' },
        { key: 'overallRankScore', label: 'Rank Score', kind: 'number' },
        { key: 'pvpBattlesWon', label: 'PvP Battles Won', kind: 'number' },
        { key: 'pvpBattlesLost', label: 'PvP Battles Lost', kind: 'number' },
        { key: 'pvpKillsAttack', label: 'PvP Unit Kills', kind: 'number' },
        { key: 'pvpCapturesAttack', label: 'PvP Unit Captures', kind: 'number' }
    ];

    const NATIONAL_COLUMNS = [
        { key: 'playerName', label: 'Player Name', kind: 'text', alwaysShow: true },
        { key: 'nationRanking', label: 'Nation Ranking', kind: 'ranking', alwaysShow: true },
        { key: 'commanderRankTitle', label: 'Commander', kind: 'text' },
        { key: 'globalRanking', label: 'Global Ranking', kind: 'ranking' },
        { key: 'sfParticipations', label: 'Strike Force', kind: 'number' },
        { key: 'cityBattlesWon', label: 'City Battles Won', kind: 'number' },
        { key: 'cityBattlesLost', label: 'City Battles Lost', kind: 'number' },
        { key: 'sfCityBattles', label: 'SF City Battles', kind: 'number' },
        { key: 'cityKillsAttack', label: 'City Unit Kills', kind: 'number' },
        { key: 'cityCapturesAttack', label: 'City Unit Captures', kind: 'number' }
    ];

    const PERSONAL_SECTIONS = [
        {
            title: 'Standing',
            stats: [
                { key: 'globalRanking', label: 'Global Ranking', kind: 'ranking' },
                { key: 'nationRanking', label: 'Nation Ranking', kind: 'ranking' },
                { key: 'commanderRankTitle', label: 'Commander', kind: 'text' },
                { key: 'nationName', label: 'Nation', kind: 'text' }
            ]
        },
        {
            title: 'Scores',
            stats: [
                { key: 'overallPvpScore', label: 'PvP Score', kind: 'number' },
                { key: 'overallRankScore', label: 'Rank Score', kind: 'number' }
            ]
        },
        {
            title: 'PvP Combat',
            stats: [
                { key: 'pvpBattlesWon', label: 'PvP Battles Won', kind: 'number' },
                { key: 'pvpBattlesLost', label: 'PvP Battles Lost', kind: 'number' },
                { key: 'pvpKillsAttack', label: 'PvP Unit Kills', kind: 'number' },
                { key: 'pvpCapturesAttack', label: 'PvP Unit Captures', kind: 'number' }
            ]
        },
        {
            title: 'City Operations',
            stats: [
                { key: 'cityBattlesWon', label: 'City Battles Won', kind: 'number' },
                { key: 'cityBattlesLost', label: 'City Battles Lost', kind: 'number' },
                { key: 'sfParticipations', label: 'Strike Force', kind: 'number' },
                { key: 'sfCityBattles', label: 'SF City Battles', kind: 'number' },
                { key: 'cityKillsAttack', label: 'City Unit Kills', kind: 'number' },
                { key: 'cityCapturesAttack', label: 'City Unit Captures', kind: 'number' }
            ]
        }
    ];

    const TAB_INTRO = {
        personal: {
            eyebrow: 'Personal Rankings',
            copy: 'Your full participation ledger — every score, battle, and strike force record tied to your commander.'
        },
        national: {
            eyebrow: 'National Rankings',
            copy: 'Nation-only intelligence for your realm. City operations and confidential stats are visible here — never shared with rival nations.'
        },
        global: {
            eyebrow: 'Global Rankings',
            copy: 'Amnek-wide standings. PvP scores and public participation stats visible to every commander in the Age.'
        }
    };

    let bound = false;
    let activeTab = 'personal';
    let loadPromise = null;
    let recordsRankingLive = false;
    let snapshotCache = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function getActiveUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            const value = String(global.getActiveCommanderUsername() || '').trim();
            if (value) return value;
        }
        return String(global.localStorage?.getItem('username') || global.localStorage?.getItem('loggedInUser') || '').trim();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatCellValue(value, kind, options = {}) {
        const emptyDisplay = options.emptyDisplay ?? PLACEHOLDER;

        if (value === null || value === undefined || value === '') {
            return emptyDisplay;
        }
        if (kind === 'number') {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return emptyDisplay;
            return numeric.toLocaleString('en-US');
        }
        return String(value);
    }

    function resolveCommanderRankTitle(row) {
        if (row?.commanderRankTitle) return row.commanderRankTitle;
        const rank = row?.commanderRank;
        if (rank == null || rank === '') return null;
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(
                rank,
                row.commanderRankPath,
                row.commanderRankTitleGender
            );
        }
        if (rankTitles?.getCommanderRankDisplayTitle) {
            return rankTitles.getCommanderRankDisplayTitle(
                rank,
                row.commanderRankPath,
                row.commanderRankTitleGender
            ) || null;
        }
        return null;
    }

    function normalizePersonalRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const merged = { ...record };
        merged.commanderRankTitle = resolveCommanderRankTitle(merged);
        if (!recordsRankingLive || merged.hasJoinedAge === false) {
            merged.globalRanking = null;
            merged.nationRanking = null;
        }
        return merged;
    }

    function normalizeTableRows(rows) {
        return (Array.isArray(rows) ? rows : [])
            .map((row) => {
                if (!row) return null;
                const merged = { ...row };
                merged.commanderRankTitle = resolveCommanderRankTitle(merged);
                if (!recordsRankingLive || merged.hasJoinedAge === false) {
                    merged.globalRanking = null;
                    merged.nationRanking = null;
                }
                return merged;
            })
            .filter(Boolean);
    }

    function resolveCellValue(row, column, options = {}) {
        if (column.kind === 'ranking') {
            if (!recordsRankingLive || row.hasJoinedAge === false) {
                return PLACEHOLDER;
            }
            return formatCellValue(row[column.key], 'number', { emptyDisplay: PLACEHOLDER });
        }

        const rawValue = row[column.key];
        const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== '';
        const value = hasValue ? rawValue : column.defaultValue;

        if (column.alwaysShow && column.key) {
            if (value === null || value === undefined || value === '') {
                if (column.kind === 'number') {
                    return formatCellValue(column.defaultValue ?? 0, 'number', options);
                }
                return String(column.defaultValue ?? options.emptyDisplay ?? PLACEHOLDER);
            }
            return formatCellValue(value, column.kind, options);
        }

        if (!hasValue) {
            return formatCellValue(column.defaultValue, column.kind, options);
        }
        return formatCellValue(rawValue, column.kind, options);
    }

    async function fetchRecordsSnapshot() {
        const username = getActiveUsername();
        const emptySnapshot = {
            personal: null,
            national: { nationId: null, nationName: null, players: [] },
            global: { players: [] },
            recordsRanking: null
        };

        if (!username) {
            return emptySnapshot;
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/records?username=${encodeURIComponent(username)}`)
            );
            if (!response.ok) {
                throw new Error(`records ${response.status}`);
            }
            const payload = await response.json();
            return {
                personal: payload.personal || null,
                national: {
                    nationId: payload.national?.nationId || null,
                    nationName: payload.national?.nationName || null,
                    players: Array.isArray(payload.national?.players) ? payload.national.players : []
                },
                global: {
                    players: Array.isArray(payload.global?.players) ? payload.global.players : []
                },
                recordsRanking: payload.recordsRanking || null,
                viewerNationId: payload.viewerNationId || null
            };
        } catch (error) {
            console.warn('[RIFT] Age Records snapshot fetch failed:', error);
            return emptySnapshot;
        }
    }

    function renderRecordsTable({ columns, rows, rowKey, emptyMessage, selfMatchKey, cellOptions = {} }) {
        const activeUsername = getActiveUsername().toLowerCase();

        if (!rows.length) {
            if (emptyMessage) {
                return `<p class="age-records-empty">${escapeHtml(emptyMessage)}</p>`;
            }
            return '';
        }

        const headerCells = columns.map((column, columnIndex) => {
            const identityClass = column.alwaysShow || columnIndex === 0 ? ' age-records-table-head--identity' : '';
            return (
                `<th scope="col" class="age-records-table-head${identityClass}" data-col="${escapeHtml(column.key)}">`
                + `<span class="age-records-table-head-label">${escapeHtml(column.label)}</span>`
                + '</th>'
            );
        }).join('');

        const bodyRows = rows.map((row) => {
            const rowId = String(row[rowKey] || '');
            const isSelf = Boolean(
                selfMatchKey
                && activeUsername
                && String(row[selfMatchKey] || '').trim().toLowerCase() === activeUsername
            );
            const rowClass = isSelf ? 'age-records-table-row is-self' : 'age-records-table-row';
            const cells = columns.map((column, columnIndex) => {
                const cellValue = resolveCellValue(row, column, cellOptions);
                const isEmptyCell = cellValue === (cellOptions.emptyDisplay ?? PLACEHOLDER);
                const emptyClass = isEmptyCell ? ' is-empty' : ' has-value';
                const identityClass = column.alwaysShow || columnIndex === 0 ? ' age-records-table-cell--identity' : '';
                const rankClass = column.kind === 'ranking' || column.key === 'rank' ? ' age-records-table-cell--rank' : '';
                return (
                    `<td class="age-records-table-cell age-records-table-cell--${column.kind}${identityClass}${rankClass}${emptyClass}" data-col="${escapeHtml(column.key)}">`
                    + `<span class="age-records-table-cell-inner">${escapeHtml(cellValue)}</span>`
                    + '</td>'
                );
            }).join('');

            return `<tr class="${rowClass}" data-record-id="${escapeHtml(rowId)}">${cells}</tr>`;
        }).join('');

        return (
            `<div class="age-records-table-frame" aria-hidden="false">`
            + '<div class="age-records-table-frame-corners" aria-hidden="true"></div>'
            + '<div class="age-records-table-scroll">'
            + '<table class="age-records-table">'
            + `<thead><tr>${headerCells}</tr></thead>`
            + `<tbody>${bodyRows}</tbody>`
            + '</table>'
            + '</div>'
            + '</div>'
        );
    }

    function renderPersonalStatValue(row, stat) {
        if (stat.kind === 'ranking') {
            if (!recordsRankingLive || row.hasJoinedAge === false) return PLACEHOLDER;
            return formatCellValue(row[stat.key], 'number', { emptyDisplay: PLACEHOLDER });
        }
        return formatCellValue(row[stat.key], stat.kind, { emptyDisplay: RECORDS_EMPTY });
    }

    function renderPersonalPanel(record) {
        const panel = global.document.getElementById('age-records-panel-personal');
        if (!panel) return;

        const row = normalizePersonalRecord(record);
        if (!row) {
            panel.innerHTML = '<p class="age-records-empty">Join the Age to begin recording your personal rankings.</p>';
            return;
        }

        const headerName = escapeHtml(row.playerName || row.username || 'Commander');
        const sectionsHtml = PERSONAL_SECTIONS.map((section) => {
            const statsHtml = section.stats.map((stat) => {
                const value = renderPersonalStatValue(row, stat);
                const emptyClass = value === RECORDS_EMPTY || value === PLACEHOLDER ? ' is-empty' : ' has-value';
                return (
                    `<div class="age-records-personal-stat${emptyClass}">`
                    + `<span class="age-records-personal-stat-label">${escapeHtml(stat.label)}</span>`
                    + `<span class="age-records-personal-stat-value">${escapeHtml(value)}</span>`
                    + '</div>'
                );
            }).join('');

            return (
                `<section class="age-records-personal-section" aria-label="${escapeHtml(section.title)}">`
                + `<h3 class="age-records-personal-section-title">${escapeHtml(section.title)}</h3>`
                + `<div class="age-records-personal-stat-grid">${statsHtml}</div>`
                + '</section>'
            );
        }).join('');

        panel.innerHTML = (
            '<div class="age-records-personal-shell">'
            + '<header class="age-records-personal-head">'
            + `<p class="age-records-personal-eyebrow">Your Commander Record</p>`
            + `<h2 class="age-records-personal-name">${headerName}</h2>`
            + '</header>'
            + `<div class="age-records-personal-sections">${sectionsHtml}</div>`
            + '</div>'
        );
    }

    function renderNationalPanel(national) {
        const panel = global.document.getElementById('age-records-panel-national');
        if (!panel) return;

        if (!national?.nationId) {
            panel.innerHTML = '<p class="age-records-empty">Enlist with a nation to view national rankings.</p>';
            return;
        }

        const rows = normalizeTableRows(national.players);
        const nationLabel = national.nationName || national.nationId;
        panel.innerHTML = (
            `<p class="age-records-scope-banner">${escapeHtml(nationLabel)} — nation intelligence only</p>`
            + (rows.length
                ? renderRecordsTable({
                    columns: NATIONAL_COLUMNS,
                    rows,
                    rowKey: 'username',
                    selfMatchKey: 'username',
                    cellOptions: { emptyDisplay: RECORDS_EMPTY }
                })
                : `<p class="age-records-empty">No commanders from ${escapeHtml(nationLabel)} have recorded stats yet.</p>`)
        );
    }

    function renderGlobalPanel(globalSection) {
        const panel = global.document.getElementById('age-records-panel-global');
        if (!panel) return;

        const rows = normalizeTableRows(globalSection?.players);
        panel.innerHTML = (
            rows.length
                ? renderRecordsTable({
                    columns: GLOBAL_COLUMNS,
                    rows,
                    rowKey: 'username',
                    selfMatchKey: 'username',
                    cellOptions: { emptyDisplay: RECORDS_EMPTY }
                })
                : '<p class="age-records-empty">No global rankings have been recorded for this Age yet.</p>'
        );
    }

    function syncRecordsIntro() {
        const meta = TAB_INTRO[activeTab] || TAB_INTRO.personal;
        const eyebrowEl = global.document.getElementById('age-records-intro-eyebrow');
        const copyEl = global.document.getElementById('age-records-intro-copy');

        if (eyebrowEl) {
            eyebrowEl.textContent = meta.eyebrow;
        }
        if (copyEl) {
            copyEl.textContent = meta.copy;
        }
    }

    async function renderRecordsPanels() {
        if (!loadPromise) {
            loadPromise = fetchRecordsSnapshot();
        }

        const snapshot = await loadPromise;
        snapshotCache = snapshot;
        recordsRankingLive = snapshot.recordsRanking?.live === true;
        renderPersonalPanel(snapshot.personal);
        renderNationalPanel(snapshot.national);
        renderGlobalPanel(snapshot.global);
    }

    function setActiveTab(tabId) {
        activeTab = VALID_TABS.has(tabId) ? tabId : 'personal';

        global.document.querySelectorAll('[data-age-records-tab]').forEach((button) => {
            const isActive = button.getAttribute('data-age-records-tab') === activeTab;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.tabIndex = isActive ? 0 : -1;
        });

        syncRecordsIntro();

        const panelMap = {
            personal: global.document.getElementById('age-records-panel-personal'),
            national: global.document.getElementById('age-records-panel-national'),
            global: global.document.getElementById('age-records-panel-global')
        };

        Object.entries(panelMap).forEach(([tabKey, panelEl]) => {
            if (!panelEl) return;
            const show = activeTab === tabKey;
            panelEl.hidden = !show;
            panelEl.classList.toggle('is-active', show);
        });
    }

    let recordsModalOpen = false;
    let recordsEscapeHandler = null;

    function onViewOpen() {
        loadPromise = null;
        setActiveTab(activeTab);
        void renderRecordsPanels();
    }

    function onViewClose() {
        loadPromise = null;
        snapshotCache = null;
    }

    function setRecordsModalOpen(open) {
        const modal = global.document.getElementById('age-records-modal');
        const nextOpen = Boolean(open);
        if (!modal) return;

        recordsModalOpen = nextOpen;
        modal.hidden = !nextOpen;
        modal.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        global.document.getElementById('age-records-open')?.classList.toggle('is-active', nextOpen);
        global.document.body.classList.toggle('age-records-open', nextOpen);

        if (!nextOpen) {
            onViewClose();
            if (recordsEscapeHandler) {
                global.document.removeEventListener('keydown', recordsEscapeHandler);
                recordsEscapeHandler = null;
            }
            return;
        }

        onViewOpen();
        global.document.getElementById('age-records-close')?.focus?.();

        if (!recordsEscapeHandler) {
            recordsEscapeHandler = (event) => {
                if (event.key === 'Escape') {
                    setRecordsModalOpen(false);
                }
            };
            global.document.addEventListener('keydown', recordsEscapeHandler);
        }
    }

    function bindRecords() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-records-close')?.addEventListener('click', (event) => {
            event.preventDefault();
            setRecordsModalOpen(false);
        });
        global.document.getElementById('age-records-backdrop')?.addEventListener('click', () => {
            setRecordsModalOpen(false);
        });
        global.document.getElementById('age-records-modal')?.querySelector('.age-records-dialog')?.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        global.document.querySelectorAll('[data-age-records-tab]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                setActiveTab(button.getAttribute('data-age-records-tab'));
            });
        });
    }

    function enableRecords() {
        bindRecords();
        setActiveTab('personal');
    }

    global.RoyalArmiesAgeRecords = {
        enable: enableRecords,
        onViewOpen,
        onViewClose,
        openWorkspace: () => setRecordsModalOpen(true),
        closeWorkspace: () => setRecordsModalOpen(false),
        isWorkspaceOpen: () => recordsModalOpen,
        refresh: () => {
            loadPromise = null;
            return renderRecordsPanels();
        }
    };
    global.enableAgeRecords = enableRecords;
})(window);

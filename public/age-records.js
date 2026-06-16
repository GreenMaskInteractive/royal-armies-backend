/**
 * RIFT — Age Records page (all commanders and nations) opened from the bottom bar view tabs.
 */
(function initAgeRecords(global) {
    'use strict';

    const PLACEHOLDER = '—';
    const RECORDS_EMPTY = '';

    const NATION_CATALOG = [
        { id: 'aesthene', name: 'Aesthene' },
        { id: 'aethelgard', name: 'Aethelgard' },
        { id: 'dravic', name: 'Dravic' },
        { id: 'gorz', name: 'Gorz' },
        { id: 'khaerant', name: 'Khaerant' },
        { id: 'krall', name: 'Krall' },
        { id: 'lyllis', name: 'Lyllis' },
        { id: 'mynor', name: 'Mynor' },
        { id: 'saelthine', name: 'Saelthine' },
        { id: 'skaros', name: 'Skaros' },
        { id: 'thruun', name: 'Thruun' },
        { id: 'trex', name: 'Trex' },
        { id: 'vaelior', name: 'Vaelior' },
        { id: 'vaerenth', name: 'Vaerenth' },
        { id: 'zevros', name: 'Zevros' }
    ];

    const PLAYER_COLUMNS = [
        { key: 'playerName', label: 'Player Name', kind: 'text', alwaysShow: true },
        { key: 'currentRankTitle', label: 'Current Rank', kind: 'text' },
        { key: 'overallPvpScore', label: 'Overall PvP Score', kind: 'number' },
        { key: 'overallRankScore', label: 'Overall Rank Score', kind: 'number' },
        { key: 'armyStrength', label: 'Personal Army Strength', kind: 'number' },
        { key: 'battlesWon', label: 'Battles Won', kind: 'number' },
        { key: 'battlesLost', label: 'Battles Lost', kind: 'number' },
        { key: 'sfCityBattles', label: 'SF City Battles', kind: 'number' },
        { key: 'personalGold', label: 'Personal Gold', kind: 'number' },
        { key: 'pvpKills', label: 'Unit Kills (Atk / Def)', kind: 'pair', attackKey: 'pvpKillsAttack', defenseKey: 'pvpKillsDefense' },
        { key: 'pvpInjuries', label: 'Unit Injuries (Atk / Def)', kind: 'pair', attackKey: 'pvpInjuriesAttack', defenseKey: 'pvpInjuriesDefense' },
        { key: 'pvpCaptures', label: 'Unit Captures (Atk / Def)', kind: 'pair', attackKey: 'pvpCapturesAttack', defenseKey: 'pvpCapturesDefense' }
    ];

    const NATION_COLUMNS = [
        { key: 'nationName', label: 'Nation Name', kind: 'text', alwaysShow: true },
        { key: 'rank', label: 'Rank', kind: 'number', alwaysShow: true },
        { key: 'points', label: 'Points', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'citiesOwned', label: 'Cities (Owned)', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'totalCities', label: 'Cities (Total)', kind: 'number', alwaysShow: true, defaultValue: 15 },
        { key: 'playersInNation', label: 'Players', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'cityCaptures', label: 'Captures', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'overallStrength', label: 'Strength', kind: 'text', alwaysShow: true, defaultValue: 'N/A' },
        { key: 'overallGoldWealth', label: 'Wealth', kind: 'text', alwaysShow: true, defaultValue: 'N/A' },
        { key: 'cityCaptureBattlePoints', label: 'Battle Points', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'overallPvpStrength', label: 'PvP Strength', kind: 'text', alwaysShow: true, defaultValue: 'N/A' },
        { key: 'successfulDropsPerformed', label: 'Drops (Attacker)', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'successfulDropsAgainstNation', label: 'Drops (Defender)', kind: 'number', alwaysShow: true, defaultValue: 0 },
        { key: 'leader', label: 'Leader', kind: 'text', alwaysShow: true, defaultValue: 'None' },
        { key: 'viceLeader', label: 'Vice Leader', kind: 'text', alwaysShow: true, defaultValue: 'None' }
    ];

    const TAB_INTRO = {
        players: {
            eyebrow: 'Commander Ledger',
            copy: 'All registered commanders on Royal Armies. Age stats appear as they are recorded through official round gameplay.'
        },
        nations: {
            eyebrow: 'Nation Ledger',
            copy: 'All fifteen nations on the Amnek continent. Stats appear as they are recorded.'
        }
    };

    let bound = false;
    let activeTab = 'players';
    let loadPromise = null;

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

    function formatPairCell(row, column, options = {}) {
        const emptyDisplay = options.emptyDisplay ?? PLACEHOLDER;
        const attackRaw = row[column.attackKey];
        const defenseRaw = row[column.defenseKey];
        const hasAttack = attackRaw !== null && attackRaw !== undefined && attackRaw !== '';
        const hasDefense = defenseRaw !== null && defenseRaw !== undefined && defenseRaw !== '';

        if (!hasAttack && !hasDefense) {
            return emptyDisplay;
        }

        const attack = hasAttack ? formatCellValue(attackRaw, 'number', options) : emptyDisplay;
        const defense = hasDefense ? formatCellValue(defenseRaw, 'number', options) : emptyDisplay;

        return `${attack} / ${defense}`;
    }

    function buildEmptyPlayerRow(username, playerName) {
        return {
            username: String(username || '').trim(),
            playerName: String(playerName || username || '').trim(),
            currentRank: null,
            currentRankTitle: null,
            overallPvpScore: null,
            overallRankScore: null,
            armyStrength: null,
            battlesWon: null,
            battlesLost: null,
            sfCityBattles: null,
            personalGold: null,
            pvpKillsAttack: null,
            pvpKillsDefense: null,
            pvpInjuriesAttack: null,
            pvpInjuriesDefense: null,
            pvpCapturesAttack: null,
            pvpCapturesDefense: null
        };
    }

    function resolveCommanderRankTitle(row) {
        if (row?.currentRankTitle) return row.currentRankTitle;
        const rank = row?.currentRank;
        if (rank == null || rank === '') return null;
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(
                rank,
                row.currentRankPath,
                row.currentRankTitleGender
            );
        }
        if (rankTitles?.getCommanderRankDisplayTitle) {
            return rankTitles.getCommanderRankDisplayTitle(
                rank,
                row.currentRankPath,
                row.currentRankTitleGender
            ) || null;
        }
        return null;
    }

    function normalizePlayerRows(apiPlayers) {
        const rows = (Array.isArray(apiPlayers) ? apiPlayers : [])
            .map((row) => {
                const username = String(row?.username || '').trim();
                if (!username) return null;

                const playerName = String(row?.playerName || username).trim() || username;
                const merged = {
                    ...buildEmptyPlayerRow(username, playerName),
                    ...row,
                    username,
                    playerName
                };
                if (merged.hasJoinedAge === false) {
                    merged.currentRank = null;
                    merged.currentRankTitle = null;
                    merged.currentRankPath = null;
                    merged.currentRankTitleGender = null;
                } else {
                    merged.currentRankTitle = resolveCommanderRankTitle(merged);
                }
                return merged;
            })
            .filter(Boolean);

        rows.sort((left, right) => left.playerName.localeCompare(right.playerName, undefined, { sensitivity: 'base' }));
        return rows;
    }

    function resolveCellValue(row, column, options = {}) {
        if (column.kind === 'pair') {
            return formatPairCell(row, column, options);
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

    function buildEmptyNationRow(nation, rank) {
        return {
            nationId: nation.id,
            nationName: nation.name,
            rank,
            points: 0,
            citiesOwned: 0,
            totalCities: 15,
            playersInNation: 0,
            cityCaptures: 0,
            overallStrength: 'N/A',
            overallGoldWealth: 'N/A',
            cityCaptureBattlePoints: 0,
            overallPvpStrength: 'N/A',
            successfulDropsPerformed: 0,
            successfulDropsAgainstNation: 0,
            leader: 'None',
            viceLeader: 'None'
        };
    }

    function mergeNationRows(apiNations) {
        const byId = new Map();
        (Array.isArray(apiNations) ? apiNations : []).forEach((row) => {
            const nationId = String(row?.nationId || '').trim().toLowerCase();
            if (nationId) {
                byId.set(nationId, row);
            }
        });

        return NATION_CATALOG.map((nation, index) => {
            const existing = byId.get(nation.id);
            const rank = index + 1;
            if (existing) {
                return {
                    ...buildEmptyNationRow(nation, rank),
                    ...existing,
                    nationId: nation.id,
                    nationName: existing.nationName || nation.name,
                    rank
                };
            }
            return buildEmptyNationRow(nation, rank);
        });
    }

    async function fetchRecordsSnapshot() {
        const username = getActiveUsername();
        const emptySnapshot = { players: [], nations: [] };

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
                players: Array.isArray(payload.players) ? payload.players : [],
                nations: Array.isArray(payload.nations) ? payload.nations : []
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
                const rankClass = column.key === 'rank' ? ' age-records-table-cell--rank' : '';
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
            + `<div class="age-records-table-scroll">`
            + `<table class="age-records-table">`
            + `<thead><tr>${headerCells}</tr></thead>`
            + `<tbody>${bodyRows}</tbody>`
            + '</table>'
            + '</div>'
            + '</div>'
        );
    }

    function renderPlayerPanel(players) {
        const panel = global.document.getElementById('age-records-panel-players');
        if (!panel) return;

        const rows = normalizePlayerRows(players);

        panel.innerHTML = (
            rows.length
                ? renderRecordsTable({
                    columns: PLAYER_COLUMNS,
                    rows,
                    rowKey: 'username',
                    selfMatchKey: 'username',
                    cellOptions: { emptyDisplay: RECORDS_EMPTY }
                })
                : `<p class="age-records-empty">No registered commanders yet.</p>`
        );
    }

    function renderNationPanel(nations) {
        const panel = global.document.getElementById('age-records-panel-nations');
        if (!panel) return;

        const rows = mergeNationRows(nations);

        panel.innerHTML = renderRecordsTable({
            columns: NATION_COLUMNS,
            rows,
            rowKey: 'nationId',
            cellOptions: { emptyDisplay: RECORDS_EMPTY }
        });
    }

    function syncRecordsIntro() {
        const meta = TAB_INTRO[activeTab] || TAB_INTRO.players;
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
        renderPlayerPanel(snapshot.players);
        renderNationPanel(snapshot.nations);
    }

    function setActiveTab(tabId) {
        activeTab = tabId === 'nations' ? 'nations' : 'players';

        global.document.querySelectorAll('[data-age-records-tab]').forEach((button) => {
            const isActive = button.getAttribute('data-age-records-tab') === activeTab;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.tabIndex = isActive ? 0 : -1;
        });

        syncRecordsIntro();

        const playersPanel = global.document.getElementById('age-records-panel-players');
        const nationsPanel = global.document.getElementById('age-records-panel-nations');

        if (playersPanel) {
            const showPlayers = activeTab === 'players';
            playersPanel.hidden = !showPlayers;
            playersPanel.classList.toggle('is-active', showPlayers);
        }

        if (nationsPanel) {
            const showNations = activeTab === 'nations';
            nationsPanel.hidden = !showNations;
            nationsPanel.classList.toggle('is-active', showNations);
        }
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
        setActiveTab('players');
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

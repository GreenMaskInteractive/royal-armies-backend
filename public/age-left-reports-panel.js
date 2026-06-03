/**
 * RIFT — Left HUD reports tabs (Nation Status, Intelligence, Weekly Missions).
 */
(function initAgeLeftReportsPanel(global) {
    'use strict';

    const TAB_ORDER = ['nation', 'intelligence', 'events'];
    const WEEKLY_MISSION_DIFFICULTY_TITLES = ['Novice', 'Intermediate', 'Hard', 'Extreme'];
    const MAP_TERRAIN_TYPES = ['Mountains', 'Marshlands', 'Forest', 'Plains', 'Desert'];
    const COMPACT_NATION_STATUS_TERRAIN_NATIONS = Object.freeze(['aesthene']);
    const TERRAIN_SWATCH_CLASS = {
        Mountains: 'mountains',
        Marshlands: 'marshlands',
        Forest: 'forest',
        Plains: 'plains',
        Desert: 'desert'
    };
    const NATION_TERRAIN_BONUS_OVERRIDES = {
        aesthene: {
            Forest: 3,
            Mountains: -2,
            Marshlands: -3,
            Plains: 2,
            Desert: 0
        }
    };
    const INTELLIGENCE_PEACE_COPY = 'Your nation is not currently at war. There is no intelligence detail to provide.';
    const NATION_CATALOG = [
        { id: 'dravic', name: 'Dravic', crestUrl: 'images/draviccrest.png' },
        { id: 'aesthene', name: 'Aesthene', crestUrl: 'images/aesthenecrest.png' },
        { id: 'vaerenth', name: 'Vaerenth', crestUrl: 'images/vaerenthcrest.png' },
        { id: 'lyllis', name: 'Lyllis', crestUrl: 'images/lylliscrest.png' },
        { id: 'thruun', name: 'Thruun', crestUrl: 'images/thruuncrest.png' },
        { id: 'aethelgard', name: 'Aethelgard', crestUrl: 'images/aethelgardcrest.png' },
        { id: 'krall', name: 'Krall', crestUrl: 'images/krallcrest.png' },
        { id: 'saelthine', name: 'Saelthine', crestUrl: 'images/saelthinecrest.png' },
        { id: 'trex', name: 'Trex', crestUrl: 'images/trexcrest.png' },
        { id: 'gorz', name: 'Gorz', crestUrl: 'images/gorzcrest.png' },
        { id: 'zevros', name: 'Zevros', crestUrl: 'images/zevroscrest.png' },
        { id: 'skaros', name: 'Skaros', crestUrl: 'images/skaroscrest.png' },
        { id: 'vaelior', name: 'Vaelior', crestUrl: 'images/vaeliorcrest.png' },
        { id: 'mynor', name: 'Mynor', crestUrl: 'images/mynorcrest.png' },
        { id: 'khaerant', name: 'Khaerant', crestUrl: 'images/khaerantcrest.png' }
    ];

    let intelligenceMockData = null;
    let activeEnemyNationId = '';
    let weeklyMissionsMockData = null;
    let nationLeadershipRefreshPromise = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function isLocalDevLeadershipPreviewHost() {
        const host = String(global.location?.hostname || '').toLowerCase();
        const port = String(global.location?.port || '');
        const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
        return isLocalHost && ['3000', '5500'].includes(port);
    }

    function resolveLeadershipPlaceholderLabel() {
        return '--';
    }

    function resolveLocalDevLeadershipPreviewName() {
        return resolveActiveCommanderUsername() || resolveLeadershipPlaceholderLabel();
    }

    function applyNationLeadershipDisplay(leaderName, viceLeaderName) {
        const leaderEl = global.document.getElementById('age-nation-status-leader-name');
        const viceEl = global.document.getElementById('age-nation-status-vice-leader-name');

        if (leaderEl) {
            leaderEl.textContent = leaderName || resolveLeadershipPlaceholderLabel();
            leaderEl.classList.toggle('is-empty', !leaderName || leaderName === resolveLeadershipPlaceholderLabel());
        }

        if (viceEl) {
            viceEl.textContent = viceLeaderName || resolveLeadershipPlaceholderLabel();
            viceEl.classList.toggle('is-empty', !viceLeaderName || viceLeaderName === resolveLeadershipPlaceholderLabel());
        }
    }

    function resolveLeadershipNameFromPayload(entry) {
        const name = String(entry?.name || entry?.username || '').trim();
        return name || '';
    }

    function scheduleAgeMapHudLayoutSync() {
        if (typeof global.syncAgeMapHudLayout !== 'function') return;
        global.requestAnimationFrame(() => {
            global.requestAnimationFrame(global.syncAgeMapHudLayout);
        });
    }

    async function refreshNationLeadershipRoster() {
        const leaderEl = global.document.getElementById('age-nation-status-leader-name');
        const viceEl = global.document.getElementById('age-nation-status-vice-leader-name');
        if (!leaderEl && !viceEl) return;

        const username = resolveActiveCommanderUsername();
        if (!username) {
            applyNationLeadershipDisplay('', '');
            return;
        }

        if (nationLeadershipRefreshPromise) {
            return nationLeadershipRefreshPromise;
        }

        nationLeadershipRefreshPromise = (async () => {
            let leaderName = '';
            let viceLeaderName = '';

            try {
                const url = resolveApiUrl(`/api/portal/age/nation-leadership?username=${encodeURIComponent(username)}`);
                const response = await global.fetch(url, { credentials: 'same-origin', cache: 'no-store' });
                const data = await response.json();

                if (data?.status === 'ok') {
                    leaderName = resolveLeadershipNameFromPayload(data.leader);
                    viceLeaderName = resolveLeadershipNameFromPayload(data.viceLeader);
                }
            } catch (error) {
                // Fall through to local preview / placeholders.
            }

            if (!leaderName && !viceLeaderName && isLocalDevLeadershipPreviewHost()) {
                const previewName = resolveLocalDevLeadershipPreviewName();
                leaderName = previewName;
                viceLeaderName = previewName;
            }

            applyNationLeadershipDisplay(leaderName, viceLeaderName);
            scheduleAgeMapHudLayoutSync();
        })().finally(() => {
            nationLeadershipRefreshPromise = null;
        });

        return nationLeadershipRefreshPromise;
    }

    function resolveMissionStatus(progress, goal) {
        const current = Math.max(0, Number(progress) || 0);
        const target = Math.max(1, Number(goal) || 1);
        if (current <= 0) return 'not-started';
        if (current >= target) return 'completed';
        return 'started';
    }

    function buildWeeklyMissionsMockData() {
        const username = resolveActiveCommanderUsername() || 'guest';
        const nationId = resolvePlayerNationId() || 'unknown';
        const baseSeed = `${username}|${nationId}|weekly-missions`;
        const templates = [
            { id: 'pvp-wins', title: 'Win PvP Battles', type: 'PvP', goalMin: 3, goalMax: 10, xpBase: 70 },
            { id: 'city-attacks', title: 'Win City Battles', type: 'City Battles', goalMin: 2, goalMax: 7, xpBase: 90 },
            { id: 'unit-usage', title: 'Deploy Specific Units', type: 'Unit Usage', goalMin: 12, goalMax: 40, xpBase: 60 },
            { id: 'unit-kills', title: 'Eliminate Specific Units', type: 'Unit Kills', goalMin: 8, goalMax: 28, xpBase: 85 },
            { id: 'siege-support', title: 'Assist Siege Operations', type: 'Support', goalMin: 4, goalMax: 12, xpBase: 75 }
        ];

        return templates.map((template, index) => {
            const goal = randomIntFromSeed(`${baseSeed}|${template.id}|goal`, template.goalMin, template.goalMax);
            const difficultyIndex = randomIntFromSeed(`${baseSeed}|${template.id}|difficulty`, 0, WEEKLY_MISSION_DIFFICULTY_TITLES.length - 1);
            const difficulty = WEEKLY_MISSION_DIFFICULTY_TITLES[difficultyIndex];
            const progress = 0;
            const status = 'not-started';
            return {
                id: template.id,
                title: template.title,
                type: template.type,
                goal,
                progress,
                status,
                difficulty,
                xpReward: template.xpBase * (difficultyIndex + 1)
            };
        });
    }

    function renderWeeklyMissionCard(mission) {
        const statusClass = mission.status;
        const difficultyKey = String(mission.difficulty || '').trim().toLowerCase();
        let statusLabel = 'Not Started';
        let progressLabel = 'Not started';

        if (mission.status === 'started') {
            statusLabel = 'Started';
            progressLabel = mission.goal > 0
                ? `${Math.min(100, Math.round((mission.progress / mission.goal) * 100))}%`
                : `${mission.progress}/${mission.goal}`;
        } else if (mission.status === 'completed') {
            statusLabel = 'Completed';
            progressLabel = 'Completed';
        }

        return `
            <li class="age-weekly-mission-card is-${statusClass}">
                <header class="age-weekly-mission-head">
                    <h4 class="age-weekly-mission-title">${mission.title}</h4>
                    <span class="age-weekly-mission-status">${statusLabel}</span>
                </header>
                <div class="age-weekly-mission-body">
                    <div class="age-weekly-mission-body-left">
                        <p class="age-weekly-mission-type">${mission.type}</p>
                    </div>
                    <p class="age-weekly-mission-progress">${progressLabel}</p>
                </div>
                <footer class="age-weekly-mission-meta">
                    <span class="age-weekly-mission-difficulty age-weekly-mission-difficulty--${difficultyKey}">Difficulty ${mission.difficulty}</span>
                    <span class="age-weekly-mission-xp">${mission.xpReward} XP</span>
                </footer>
            </li>
        `;
    }

    function refreshWeeklyMissionsPanel() {
        const list = global.document.getElementById('age-weekly-missions-list');
        if (!list) return;

        weeklyMissionsMockData = buildWeeklyMissionsMockData();
        list.innerHTML = weeklyMissionsMockData.map((mission) => renderWeeklyMissionCard(mission)).join('');
    }

    function normalizeNationId(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    function resolveActiveCommanderUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            const value = String(global.getActiveCommanderUsername() || '').trim();
            if (value) return value;
        }
        return '';
    }

    function resolvePlayerNationId() {
        const playerNation = global.player?.gameNation || global.player?.nation;
        if (playerNation) return normalizeNationId(playerNation);

        const username = resolveActiveCommanderUsername();
        if (!username) return '';
        const stored = global.localStorage.getItem(`royalArmies_${username}_ageDeploymentNationId`);
        return normalizeNationId(stored);
    }

    function hashString(seed) {
        let hash = 2166136261;
        const source = String(seed || '');
        for (let i = 0; i < source.length; i += 1) {
            hash ^= source.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function randomIntFromSeed(seed, min, max) {
        const hash = hashString(seed);
        const span = max - min + 1;
        return min + (hash % span);
    }

    function generateNationTerrainBonuses(nationId) {
        const normalizedId = normalizeNationId(nationId);
        const override = NATION_TERRAIN_BONUS_OVERRIDES[normalizedId];
        if (override) {
            return { ...override };
        }

        const bonuses = {};
        MAP_TERRAIN_TYPES.forEach((terrain) => {
            bonuses[terrain] = randomIntFromSeed(`${normalizedId}|${terrain}|bonus`, -2, 2);
        });
        return bonuses;
    }

    function resolvePlayerNationMeta() {
        const playerNationId = resolvePlayerNationId();
        return resolveNationMeta(playerNationId) || NATION_CATALOG[0];
    }

    function resolvePlayerTerrainBonuses() {
        return generateNationTerrainBonuses(resolvePlayerNationMeta().id);
    }

    function terrainBonusStateClass(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return 'is-positive';
        if (amount < 0) return 'is-negative';
        return 'is-neutral';
    }

    function buildNationStatusTerrainRows(bonuses, nationId) {
        const compact = COMPACT_NATION_STATUS_TERRAIN_NATIONS.includes(normalizeNationId(nationId));
        const terrains = MAP_TERRAIN_TYPES;

        if (compact) {
            return terrains.map((terrain) => {
                const value = Number(bonuses[terrain] || 0);
                const stateClass = terrainBonusStateClass(value);
                const swatchClass = TERRAIN_SWATCH_CLASS[terrain] || 'plains';
                return `
                    <li class="age-nation-status-terrain-tile ${stateClass}">
                        <span class="age-nation-status-terrain-tile-swatch age-nation-status-terrain-tile-swatch--${swatchClass}" aria-hidden="true"></span>
                        <span class="age-nation-status-terrain-tile-label">${terrain}</span>
                        <span class="age-nation-status-terrain-tile-value">${formatSignedBonus(value)}</span>
                    </li>
                `;
            }).join('');
        }

        return terrains.map((terrain) => {
            const value = Number(bonuses[terrain] || 0);
            const stateClass = terrainBonusStateClass(value);
            return `
                <li class="age-nation-status-terrain-row ${stateClass}">
                    <span class="age-nation-status-terrain-name">${terrain}</span>
                    <span class="age-nation-status-terrain-value">${formatSignedBonus(value)}</span>
                </li>
            `;
        }).join('');
    }

    function refreshNationStatusPanel() {
        const list = global.document.getElementById('age-nation-status-terrain-list');
        if (list) {
            const nationMeta = resolvePlayerNationMeta();
            const bonuses = resolvePlayerTerrainBonuses();
            const compact = COMPACT_NATION_STATUS_TERRAIN_NATIONS.includes(nationMeta.id);
            list.classList.toggle('age-nation-status-terrain-list--compact', compact);
            list.innerHTML = buildNationStatusTerrainRows(bonuses, nationMeta.id);
        }

        refreshNationLeadershipRoster();
    }

    function resolveActiveWarMatchups(playerNationId) {
        // Returns nations actively at war with the player's nation once NEXUS war state is wired.
        void playerNationId;
        return [];
    }

    function renderIntelligencePeaceState() {
        const shell = global.document.querySelector('#age-left-reports-tab-intelligence .age-intelligence-matchups-shell');
        const tabsHost = global.document.getElementById('age-intelligence-enemy-tabs');
        const contentHost = global.document.getElementById('age-intelligence-matchup-content');

        if (shell) {
            shell.classList.add('is-at-peace');
        }

        if (tabsHost) {
            tabsHost.innerHTML = '';
            tabsHost.hidden = true;
        }

        if (contentHost) {
            contentHost.innerHTML = `
                <div class="age-intelligence-peace-state">
                    <p class="age-intelligence-peace-title">No Active War</p>
                    <p class="age-intelligence-peace-copy">${INTELLIGENCE_PEACE_COPY}</p>
                </div>
            `;
        }

        activeEnemyNationId = '';
    }

    function resolveNationMeta(nationId) {
        return NATION_CATALOG.find((nation) => nation.id === nationId) || null;
    }

    function formatSignedBonus(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return `+${amount}`;
        if (amount < 0) return `${amount}`;
        return '0';
    }

    function buildIntelligenceTerrainRows(playerBonuses, enemyBonuses) {
        return MAP_TERRAIN_TYPES.map((terrain) => {
            const own = Number(playerBonuses[terrain] || 0);
            const enemy = Number(enemyBonuses[terrain] || 0);
            const combined = own - enemy;
            const stateClass = combined > 0
                ? 'is-advantage'
                : (combined < 0 ? 'is-disadvantage' : 'is-even');
            const summary = combined > 0
                ? `${formatSignedBonus(combined)} advantage`
                : (combined < 0 ? `${formatSignedBonus(combined)} disadvantage` : 'Even');

            return `
                <li class="age-intelligence-terrain-row ${stateClass}">
                    <span class="age-intelligence-terrain-name">${terrain}</span>
                    <span class="age-intelligence-terrain-meta">You ${formatSignedBonus(own)} · Enemy ${formatSignedBonus(enemy)}</span>
                    <span class="age-intelligence-terrain-total">${summary}</span>
                </li>
            `;
        }).join('');
    }

    function renderIntelligenceEnemyTabs(matchups) {
        const tabsHost = global.document.getElementById('age-intelligence-enemy-tabs');
        if (!tabsHost) return;
        tabsHost.hidden = false;

        tabsHost.innerHTML = matchups.map((entry) => {
            const isActive = entry.id === activeEnemyNationId;
            return `
                <button
                    type="button"
                    class="age-intelligence-enemy-tab${isActive ? ' is-active' : ''}"
                    data-age-intelligence-enemy-id="${entry.id}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    title="${entry.name}">
                    <img class="age-intelligence-enemy-crest" src="${entry.crestUrl}" alt="${entry.name} crest" loading="lazy" decoding="async">
                    <span class="age-intelligence-enemy-label">${entry.name}</span>
                </button>
            `;
        }).join('');
    }

    function renderIntelligenceEnemyContent() {
        const contentHost = global.document.getElementById('age-intelligence-matchup-content');
        if (!contentHost || !intelligenceMockData) return;
        const enemyData = intelligenceMockData.matchups.find((entry) => entry.id === activeEnemyNationId);
        if (!enemyData) {
            contentHost.innerHTML = '<p class="age-intelligence-empty-note">No enemy matchup selected.</p>';
            return;
        }

        contentHost.innerHTML = `
            <header class="age-intelligence-matchup-header">
                <h4 class="age-intelligence-matchup-title">${enemyData.conflictType} vs ${enemyData.name}</h4>
                <p class="age-intelligence-matchup-subtitle">Combined terrain advantage matrix</p>
            </header>
            <ul class="age-intelligence-terrain-list">
                ${buildIntelligenceTerrainRows(intelligenceMockData.playerBonuses, enemyData.bonuses)}
            </ul>
        `;
    }

    function refreshIntelligencePanel() {
        const shell = global.document.querySelector('#age-left-reports-tab-intelligence .age-intelligence-matchups-shell');
        const playerNationMeta = resolvePlayerNationMeta();
        const effectivePlayerId = playerNationMeta.id;
        const playerBonuses = resolvePlayerTerrainBonuses();
        const warNations = resolveActiveWarMatchups(effectivePlayerId);
        const matchups = warNations.map((enemy) => ({
            ...enemy,
            bonuses: generateNationTerrainBonuses(enemy.id)
        }));

        intelligenceMockData = {
            playerNationId: effectivePlayerId,
            playerBonuses,
            matchups
        };

        if (!matchups.length) {
            renderIntelligencePeaceState();
            return;
        }

        if (shell) {
            shell.classList.remove('is-at-peace');
        }

        if (!activeEnemyNationId || !matchups.some((entry) => entry.id === activeEnemyNationId)) {
            activeEnemyNationId = matchups[0]?.id || '';
        }

        renderIntelligenceEnemyTabs(matchups);
        renderIntelligenceEnemyContent();
    }

    function bindIntelligenceEnemyTabs() {
        const tabsHost = global.document.getElementById('age-intelligence-enemy-tabs');
        if (!tabsHost || tabsHost.dataset.enemyTabsBound === 'true') return;
        tabsHost.dataset.enemyTabsBound = 'true';

        tabsHost.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-age-intelligence-enemy-id]');
            if (!tab) return;
            event.preventDefault();
            const enemyId = normalizeNationId(tab.getAttribute('data-age-intelligence-enemy-id'));
            if (!enemyId) return;
            activeEnemyNationId = enemyId;
            renderIntelligenceEnemyTabs(intelligenceMockData?.matchups || []);
            renderIntelligenceEnemyContent();
            scheduleAgeMapHudLayoutSync();
        });
    }

    function activateLeftReportsTab(tabId) {
        const target = String(tabId || 'nation').trim().toLowerCase();
        const tabs = global.document.querySelectorAll('[data-age-left-reports-tab]');
        const panels = global.document.querySelectorAll('.age-left-reports-tabpanel');

        tabs.forEach((tab) => {
            const isActive = tab.getAttribute('data-age-left-reports-tab') === target;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach((panel) => {
            const panelKey = panel.id?.replace('age-left-reports-tab-', '') || '';
            const isActive = panelKey === target;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        if (target === 'intelligence') {
            refreshIntelligencePanel();
        } else if (target === 'events') {
            refreshWeeklyMissionsPanel();
        } else if (target === 'nation') {
            refreshNationStatusPanel();
        }

        scheduleAgeMapHudLayoutSync();
    }

    function bindLeftReportsTabs() {
        const tablist = global.document.querySelector('.age-left-reports-tabs');
        if (!tablist || tablist.dataset.leftReportsTabsBound === 'true') return;

        tablist.dataset.leftReportsTabsBound = 'true';

        tablist.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-age-left-reports-tab]');
            if (!tab) return;
            event.preventDefault();
            activateLeftReportsTab(tab.getAttribute('data-age-left-reports-tab'));
        });

        tablist.addEventListener('keydown', (event) => {
            const tabs = TAB_ORDER.map((id) => (
                tablist.querySelector(`[data-age-left-reports-tab="${id}"]`)
            )).filter(Boolean);
            const currentIndex = tabs.findIndex((tab) => tab.classList.contains('is-active'));
            if (currentIndex < 0) return;

            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % tabs.length;
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            } else {
                return;
            }

            event.preventDefault();
            const nextTab = tabs[nextIndex];
            activateLeftReportsTab(nextTab.getAttribute('data-age-left-reports-tab'));
            nextTab.focus();
        });
    }

    function enableLeftReportsPanel() {
        bindLeftReportsTabs();
        bindIntelligenceEnemyTabs();
        refreshNationStatusPanel();
        refreshIntelligencePanel();
        refreshWeeklyMissionsPanel();
        activateLeftReportsTab('nation');
        scheduleAgeMapHudLayoutSync();
    }

    global.RoyalArmiesAgeLeftReportsPanel = {
        enable: enableLeftReportsPanel,
        activateTab: activateLeftReportsTab,
        refreshNationStatus: refreshNationStatusPanel,
        refreshNationLeadership: refreshNationLeadershipRoster,
        refreshIntelligence: refreshIntelligencePanel
    };

    global.enableAgeLeftReportsPanel = enableLeftReportsPanel;
})(window);

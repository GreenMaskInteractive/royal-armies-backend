/**
 * RIFT — Age map army groups workspace (slide-up panel, roster, sonar rescue ping).
 */
(function initAgeArmyGroups(global) {
    'use strict';

    const API_BASE = '/api/portal/age/army-groups';
    const TYPE_ORDER = ['sf', 'taxi', 'rally', 'hold', 'main', 'temp-main'];
    const TYPE_LABELS = {
        sf: 'SF',
        taxi: 'Taxi',
        rally: 'Rally',
        hold: 'Hold',
        main: 'Main',
        'temp-main': 'TMain'
    };
    const TYPE_CLASS = {
        sf: 'age-army-groups-type-cycle--sf',
        taxi: 'age-army-groups-type-cycle--taxi',
        rally: 'age-army-groups-type-cycle--rally',
        hold: 'age-army-groups-type-cycle--hold',
        main: 'age-army-groups-type-cycle--main',
        'temp-main': 'age-army-groups-type-cycle--temp-main'
    };
    const CATEGORY_GAP_TYPES = new Set(['temp-main', 'hold', 'rally', 'sf', 'taxi']);
    const SONAR_MAX_RADIUS_MAP_UNITS = 42;
    const REFRESH_MS = 12000;

    const els = {
        tab: null,
        workspace: null,
        createBtn: null,
        sfLeadBtn: null,
        sonarBtn: null,
        createRow: null,
        typeCycle: null,
        nameInput: null,
        createSubmit: null,
        list: null,
        feedback: null,
        sonarLayer: null
    };

    let workspaceOpen = false;
    let createPanelOpen = false;
    let selectedType = 'sf';
    let allowedTypes = ['sf', 'taxi', 'rally', 'hold'];
    let accessFlags = { canCreateMain: false, canCreateTempMain: false };
    let rosterPayload = null;
    let refreshTimer = 0;
    let sonarTimers = [];
    let sonarCycleTimer = 0;
    let localSonarActive = false;

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function showFeedback(message, isError) {
        if (!els.feedback) return;
        if (!message) {
            els.feedback.hidden = true;
            els.feedback.textContent = '';
            els.feedback.classList.remove('is-error');
            return;
        }
        els.feedback.hidden = false;
        els.feedback.textContent = message;
        els.feedback.classList.toggle('is-error', Boolean(isError));
    }

    async function parseResponse(response) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = new Error(payload.message || 'Army groups request failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }
        return payload;
    }

    function rebuildAllowedTypes() {
        const next = ['sf', 'taxi', 'rally', 'hold'];
        if (accessFlags.canCreateMain) next.push('main');
        if (accessFlags.canCreateTempMain) next.push('temp-main');
        allowedTypes = next.filter((type) => TYPE_ORDER.includes(type));
        if (!allowedTypes.includes(selectedType)) {
            selectedType = allowedTypes[0] || 'sf';
        }
    }

    function applyTypeCycleButton() {
        if (!els.typeCycle) return;
        Object.values(TYPE_CLASS).forEach((cls) => els.typeCycle.classList.remove(cls));
        const label = TYPE_LABELS[selectedType] || 'SF';
        els.typeCycle.textContent = label;
        els.typeCycle.classList.add(TYPE_CLASS[selectedType] || TYPE_CLASS.sf);
        els.typeCycle.setAttribute('aria-label', `Army group type: ${label}. Click to change.`);
    }

    function cycleSelectedType(direction) {
        if (!allowedTypes.length) return;
        const idx = Math.max(0, allowedTypes.indexOf(selectedType));
        const nextIdx = (idx + direction + allowedTypes.length) % allowedTypes.length;
        selectedType = allowedTypes[nextIdx];
        applyTypeCycleButton();
    }

    function setWorkspaceOpen(open) {
        workspaceOpen = Boolean(open);
        if (!els.workspace || !els.tab) return;
        els.workspace.hidden = !workspaceOpen;
        els.workspace.classList.toggle('is-open', workspaceOpen);
        els.workspace.setAttribute('aria-hidden', workspaceOpen ? 'false' : 'true');
        els.tab.setAttribute('aria-expanded', workspaceOpen ? 'true' : 'false');
        els.tab.classList.toggle('is-active', workspaceOpen);
        if (workspaceOpen) {
            refreshRoster();
        }
    }

    function setCreatePanelOpen(open) {
        createPanelOpen = Boolean(open);
        if (!els.createRow) return;
        els.createRow.hidden = !createPanelOpen;
        if (createPanelOpen && els.nameInput) {
            els.nameInput.focus();
        }
    }

    function resolvePlayerCity() {
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const cities = catalog?.cities;
        if (!Array.isArray(cities)) return null;

        const rawId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.() || '';
        if (!rawId) return null;
        return cities.find((city) => city.id === rawId) || null;
    }

    function syncDeploymentPinFromRoster(payload) {
        const pins = global.RoyalArmiesPlayerLocPins;
        if (!pins || typeof pins.setDeploymentFromGroupType !== 'function') return;
        const type = String(payload?.deploymentGroupType || '').trim();
        if (type) {
            pins.setDeploymentFromGroupType(type);
        }
        const pin = global.document.getElementById('age-world-map-player-pin-local');
        if (pin) {
            pin.classList.toggle('age-world-map-player-pin--taxi-aura', type === 'taxi');
        }
    }

    function renderRosterList(payload) {
        if (!els.list) return;
        const groups = Array.isArray(payload?.groups) ? payload.groups : [];
        els.list.innerHTML = '';

        let previousType = '';
        groups.forEach((group) => {
            if (previousType && group.type !== previousType) {
                const gap = global.document.createElement('div');
                gap.className = 'age-army-groups-category-gap';
                if (CATEGORY_GAP_TYPES.has(group.type) || CATEGORY_GAP_TYPES.has(previousType)) {
                    gap.classList.add('age-army-groups-category-gap--major');
                }
                els.list.appendChild(gap);
            }
            previousType = group.type;

            const row = global.document.createElement('article');
            row.className = 'age-army-groups-row';
            row.setAttribute('role', 'listitem');
            row.classList.add(`age-army-groups-row--${group.type}`);
            if (group.type === 'main') row.classList.add('age-army-groups-row--featured-main');
            if (group.type === 'temp-main') row.classList.add('age-army-groups-row--featured-temp-main');
            if (group.type === 'taxi') row.classList.add('age-army-groups-row--taxi');

            const title = global.document.createElement('h3');
            title.className = 'age-army-groups-row-title';
            title.textContent = group.name;

            const meta = global.document.createElement('p');
            meta.className = 'age-army-groups-row-meta';
            meta.textContent = `${TYPE_LABELS[group.type] || group.type} · ${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`;

            const actions = global.document.createElement('div');
            actions.className = 'age-army-groups-row-actions';

            if (!group.isMember) {
                const joinBtn = global.document.createElement('button');
                joinBtn.type = 'button';
                joinBtn.className = 'age-army-groups-join-btn';
                joinBtn.textContent = 'Join';
                joinBtn.addEventListener('click', () => joinArmyGroup(group.id));
                actions.appendChild(joinBtn);
            } else {
                const badge = global.document.createElement('span');
                badge.className = 'age-army-groups-member-badge';
                badge.textContent = group.isLeader ? 'Leading' : 'Joined';
                actions.appendChild(badge);
            }

            row.appendChild(title);
            row.appendChild(meta);
            row.appendChild(actions);
            els.list.appendChild(row);
        });

        if (!groups.length) {
            const empty = global.document.createElement('p');
            empty.className = 'age-army-groups-empty';
            empty.textContent = 'No army groups yet. Create one or signal for rescue.';
            els.list.appendChild(empty);
        }
    }

    function updateSfLeadButton(payload) {
        if (!els.sfLeadBtn) return;
        const listed = Boolean(payload?.sfLeadCandidate);
        els.sfLeadBtn.classList.toggle('is-active', listed);
        els.sfLeadBtn.setAttribute('aria-pressed', listed ? 'true' : 'false');
    }

    async function refreshRoster() {
        const username = resolveUsername();
        if (!username) return;

        try {
            const response = await fetch(
                resolveApiUrl(`${API_BASE}?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await parseResponse(response);
            rosterPayload = payload;
            accessFlags = {
                canCreateMain: Boolean(payload.access?.canCreateMain),
                canCreateTempMain: Boolean(payload.access?.canCreateTempMain)
            };
            rebuildAllowedTypes();
            applyTypeCycleButton();
            renderRosterList(payload);
            updateSfLeadButton(payload);
            syncDeploymentPinFromRoster(payload);
            syncSonarFromPayload(payload);
        } catch (err) {
            showFeedback(err.message || 'Could not load army groups.', true);
        }
    }

    async function postAction(path, body) {
        const username = resolveUsername();
        if (!username) {
            showFeedback('Commander session required.', true);
            return null;
        }
        const response = await fetch(resolveApiUrl(path), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ...body })
        });
        return parseResponse(response);
    }

    async function createArmyGroup() {
        const name = String(els.nameInput?.value || '').trim();
        if (!name) {
            showFeedback('Enter a unique army name.', true);
            return;
        }
        try {
            const payload = await postAction(`${API_BASE}/create`, {
                type: selectedType,
                name
            });
            if (els.nameInput) els.nameInput.value = '';
            setCreatePanelOpen(false);
            showFeedback(`Created ${TYPE_LABELS[selectedType] || selectedType} army “${name}”.`, false);
            rosterPayload = payload;
            renderRosterList(payload);
            syncDeploymentPinFromRoster(payload);
        } catch (err) {
            showFeedback(err.message || 'Could not create army group.', true);
        }
    }

    async function joinArmyGroup(groupId) {
        try {
            const payload = await postAction(`${API_BASE}/join`, { groupId });
            showFeedback('Joined army group.', false);
            rosterPayload = payload;
            renderRosterList(payload);
            syncDeploymentPinFromRoster(payload);
        } catch (err) {
            showFeedback(err.message || 'Could not join army group.', true);
        }
    }

    async function toggleSfLeadCandidate() {
        try {
            const payload = await postAction(`${API_BASE}/sf-lead-candidate`, {});
            rosterPayload = payload;
            updateSfLeadButton(payload);
            showFeedback(
                payload.sfLeadCandidate
                    ? 'Listed as SF Lead candidate.'
                    : 'Removed from SF Lead candidates.',
                false
            );
        } catch (err) {
            showFeedback(err.message || 'Could not update SF Lead listing.', true);
        }
    }

    function clearSonarTimers() {
        sonarTimers.forEach((id) => global.clearTimeout(id));
        sonarTimers = [];
        if (sonarCycleTimer) {
            global.clearInterval(sonarCycleTimer);
            sonarCycleTimer = 0;
        }
        if (els.sonarLayer) {
            els.sonarLayer.innerHTML = '';
        }
    }

    function mapPointToFrame(mapX, mapY) {
        if (typeof global.RoyalArmiesAgeWorldMap?.mapPointToFramePixels === 'function') {
            return global.RoyalArmiesAgeWorldMap.mapPointToFramePixels(mapX, mapY);
        }
        return { x: 0, y: 0 };
    }

    function emitSonarPing(city) {
        if (!els.sonarLayer || !city?.centroid) return;
        const center = mapPointToFrame(city.centroid.x, city.centroid.y);
        const east = mapPointToFrame(city.centroid.x + 1, city.centroid.y);
        const pxPerUnit = Math.hypot(east.x - center.x, east.y - center.y) || 1;
        const maxRadiusPx = SONAR_MAX_RADIUS_MAP_UNITS * pxPerUnit;

        const ring = global.document.createElement('span');
        ring.className = 'age-army-groups-sonar-ring';
        ring.style.left = `${center.x}px`;
        ring.style.top = `${center.y}px`;
        ring.style.setProperty('--sonar-max-radius', `${maxRadiusPx}px`);
        els.sonarLayer.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove(), { once: true });
    }

    function runSonarBurst(city, timing) {
        const pingGapMs = timing?.pingGapMs || 900;
        const pingsPerCycle = timing?.pingsPerCycle || 3;
        for (let i = 0; i < pingsPerCycle; i += 1) {
            sonarTimers.push(global.setTimeout(() => emitSonarPing(city), i * pingGapMs));
        }
    }

    function startLocalSonarSession(city, timing) {
        clearSonarTimers();
        localSonarActive = true;
        if (els.sonarLayer) {
            els.sonarLayer.setAttribute('aria-hidden', 'false');
        }
        const cycleMs = timing?.cycleMs || 10000;
        const sessionMs = timing?.sessionMs || 32000;
        runSonarBurst(city, timing);
        sonarCycleTimer = global.setInterval(() => runSonarBurst(city, timing), cycleMs);
        sonarTimers.push(global.setTimeout(() => {
            localSonarActive = false;
            clearSonarTimers();
            if (els.sonarLayer) {
                els.sonarLayer.setAttribute('aria-hidden', 'true');
            }
        }, sessionMs));
    }

    function syncSonarFromPayload(payload) {
        const session = payload?.activeSonar;
        const self = resolveUsername().toLowerCase();
        if (!session || session.username !== self || localSonarActive) return;
        const city = resolvePlayerCity();
        if (city) {
            startLocalSonarSession(city, payload.sonarTiming);
        }
    }

    async function triggerSonar() {
        try {
            const payload = await postAction(`${API_BASE}/sonar`, {});
            const city = resolvePlayerCity();
            if (city) {
                startLocalSonarSession(city, payload.sonarTiming);
            }
            showFeedback(
                payload.alreadyActive
                    ? 'Rescue sonar already active.'
                    : 'Rescue sonar broadcasting to leadership.',
                false
            );
        } catch (err) {
            showFeedback(err.message || 'Could not start sonar.', true);
        }
    }

    function bindEvents() {
        els.tab?.addEventListener('click', () => setWorkspaceOpen(!workspaceOpen));

        els.createBtn?.addEventListener('click', () => {
            setCreatePanelOpen(!createPanelOpen);
            showFeedback('', false);
        });

        els.typeCycle?.addEventListener('click', () => cycleSelectedType(1));

        els.createSubmit?.addEventListener('click', () => createArmyGroup());

        els.nameInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createArmyGroup();
            }
        });

        els.sfLeadBtn?.addEventListener('click', () => toggleSfLeadCandidate());
        els.sonarBtn?.addEventListener('click', () => triggerSonar());

        global.addEventListener('royalarmies:age-movement-updated', () => {
            if (workspaceOpen) refreshRoster();
        });
    }

    function startRefreshLoop() {
        if (refreshTimer) global.clearInterval(refreshTimer);
        refreshTimer = global.setInterval(() => {
            if (workspaceOpen) refreshRoster();
        }, REFRESH_MS);
    }

    function enable() {
        els.tab = global.document.getElementById('age-army-groups-tab');
        els.workspace = global.document.getElementById('age-army-groups-workspace');
        els.createBtn = global.document.getElementById('age-army-groups-btn-create');
        els.sfLeadBtn = global.document.getElementById('age-army-groups-btn-sf-lead');
        els.sonarBtn = global.document.getElementById('age-army-groups-btn-sonar');
        els.createRow = global.document.getElementById('age-army-groups-create-row');
        els.typeCycle = global.document.getElementById('age-army-groups-type-cycle');
        els.nameInput = global.document.getElementById('age-army-groups-name-input');
        els.createSubmit = global.document.getElementById('age-army-groups-create-submit');
        els.list = global.document.getElementById('age-army-groups-list');
        els.feedback = global.document.getElementById('age-army-groups-feedback');
        els.sonarLayer = global.document.getElementById('age-army-groups-sonar-layer');

        if (!els.tab || !els.workspace) return false;

        applyTypeCycleButton();
        bindEvents();
        startRefreshLoop();
        refreshRoster();
        return true;
    }

    function init() {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', enable, { once: true });
        } else {
            enable();
        }
    }

    global.RoyalArmiesAgeArmyGroups = {
        enable,
        refresh: refreshRoster,
        isWorkspaceOpen: () => workspaceOpen
    };

    init();
})(window);

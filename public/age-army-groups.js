/**
 * RIFT — Age War Room workspace (center modal, army groups roster, sonar rescue ping).
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
        modal: null,
        backdrop: null,
        closeBtn: null,
        openBtn: null,
        workspaceMain: null,
        createBtn: null,
        sfLeadBtn: null,
        sonarBtn: null,
        createRow: null,
        typeCycle: null,
        nameInput: null,
        createSubmit: null,
        list: null,
        feedback: null,
        sonarLayer: null,
        volunteersColumn: null,
        sfLeadList: null
    };

    let workspaceOpen = false;
    let createPanelOpen = false;
    let sfLeadPanelOpen = false;
    let selectedType = 'sf';
    let allowedTypes = ['sf', 'taxi', 'rally', 'hold'];
    let accessFlags = { canCreateMain: false, canCreateTempMain: false };
    let rosterPayload = null;
    let refreshTimer = 0;
    let sonarTimers = [];
    let sonarCycleTimer = 0;
    let localSonarActive = false;
    let escapeHandler = null;
    let eventsBound = false;
    let createInFlight = false;
    const expandedGroupIds = new Set();
    let editingNameGroupId = null;
    let armyViewModalEl = null;

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function usesCrossOriginApi() {
        return typeof global.isLiveStaticPreviewHost === 'function' && global.isLiveStaticPreviewHost();
    }

    function resolveApiFetchInit(overrides) {
        return {
            credentials: usesCrossOriginApi() ? 'include' : 'same-origin',
            cache: 'no-store',
            ...overrides
        };
    }

    function formatRosterError(err) {
        if (typeof global.isRoyalArmiesApiReachable === 'function' && !global.isRoyalArmiesApiReachable()) {
            return 'Could not reach the game server. Run node server.js on port 3000 while using Live Server (:5500).';
        }

        const message = String(err?.message || '').trim();
        const isNetworkFailure = !message
            || message === 'Failed to fetch'
            || /networkerror|load failed|connection refused/i.test(message);

        if (isNetworkFailure) {
            if (usesCrossOriginApi()) {
                return 'Could not reach the game server. Run node server.js on port 3000 while using Live Server (:5500).';
            }
            if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
                return 'Could not reach the game server. Start it with node server.js.';
            }
            return 'Could not reach army groups. Check your connection and try again.';
        }
        return message;
    }

    function warnIfApiUnreachable() {
        if (typeof global.isRoyalArmiesApiReachable === 'function' && !global.isRoyalArmiesApiReachable()) {
            showFeedback(formatRosterError(new Error('Failed to fetch')), true);
            return true;
        }
        return false;
    }

    function resolveCreateCityId() {
        const fromMovement = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        if (fromMovement) return String(fromMovement).trim();

        const city = resolvePlayerCity();
        return String(city?.id || '').trim();
    }

    function setCreateSubmitBusy(busy) {
        createInFlight = Boolean(busy);
        if (!els.createSubmit) return;
        els.createSubmit.disabled = createInFlight;
        els.createSubmit.setAttribute('aria-busy', createInFlight ? 'true' : 'false');
        els.createSubmit.textContent = createInFlight ? 'Creating…' : 'Create';
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

    function dispatchOpenChange() {
        global.dispatchEvent(new CustomEvent('royalarmies:age-war-room-open-change', {
            detail: { open: workspaceOpen }
        }));
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
        if (!els.modal) return;

        els.modal.hidden = !workspaceOpen;
        els.modal.setAttribute('aria-hidden', workspaceOpen ? 'false' : 'true');
        els.openBtn?.setAttribute('aria-expanded', workspaceOpen ? 'true' : 'false');
        els.openBtn?.classList.toggle('is-active', workspaceOpen);
        global.document.body.classList.toggle('age-war-room-open', workspaceOpen);

        if (!workspaceOpen) {
            setCreatePanelOpen(false);
            setSfLeadPanelOpen(false);
            if (escapeHandler) {
                global.document.removeEventListener('keydown', escapeHandler);
                escapeHandler = null;
            }
        } else {
            refreshRoster();
            els.closeBtn?.focus();
            if (!escapeHandler) {
                escapeHandler = (event) => {
                    if (event.key === 'Escape') {
                        setWorkspaceOpen(false);
                    }
                };
                global.document.addEventListener('keydown', escapeHandler);
            }
        }

        dispatchOpenChange();
    }

    function setCreatePanelOpen(open) {
        createPanelOpen = Boolean(open);
        if (!els.createRow) return;
        if (createPanelOpen) {
            els.createRow.removeAttribute('hidden');
            els.createRow.classList.add('is-visible');
        } else {
            els.createRow.setAttribute('hidden', '');
            els.createRow.classList.remove('is-visible');
            setCreateSubmitBusy(false);
        }
        els.createBtn?.classList.toggle('is-active', createPanelOpen);
        els.createBtn?.setAttribute('aria-expanded', createPanelOpen ? 'true' : 'false');
        if (!createPanelOpen && els.nameInput) {
            els.nameInput.value = '';
        }
        if (createPanelOpen && els.nameInput) {
            global.requestAnimationFrame(() => els.nameInput.focus());
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

    function escapeArmyHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function applyRosterPayload(payload) {
        rosterPayload = payload;
        renderRosterList(payload);
        renderSfLeadVolunteers(payload);
        updateSfLeadButton(payload);
        syncDeploymentPinFromRoster(payload);
    }

    function buildTypePill(type) {
        const pill = global.document.createElement('span');
        pill.className = `age-army-groups-type-pill ${TYPE_CLASS[type] || TYPE_CLASS.sf}`;
        pill.textContent = TYPE_LABELS[type] || type;
        return pill;
    }

    function formatMemberLabel(member) {
        const raw = String(member?.username || '').trim();
        if (!raw) return '';
        const display = raw.charAt(0).toUpperCase() + raw.slice(1);
        if (member?.isSelf) return `${display} (you)`;
        if (member?.isLeader) return `${display} (leader)`;
        return display;
    }

    function listMergeTargetGroups(groups, sourceId) {
        return (groups || []).filter((entry) => entry.id !== sourceId);
    }

    function listCommandPostGroups(groups) {
        return (groups || []).filter((entry) => entry.type === 'main' || entry.type === 'temp-main');
    }

    function listAbsorbSourceGroups(groups, targetId) {
        return (groups || []).filter((entry) => entry.id !== targetId && entry.type !== 'main' && entry.type !== 'temp-main');
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

    function buildGroupNameHead(group) {
        const wrap = global.document.createElement('div');
        wrap.className = 'age-army-groups-row-title-wrap';

        if (editingNameGroupId === group.id) {
            const input = global.document.createElement('input');
            input.type = 'text';
            input.className = 'age-army-groups-row-name-input';
            input.maxLength = 48;
            input.value = group.name;
            input.dataset.armyNameInput = group.id;
            wrap.appendChild(input);
            return wrap;
        }

        const title = global.document.createElement('h3');
        title.className = 'age-army-groups-row-title';
        title.textContent = group.name;
        wrap.appendChild(title);
        return wrap;
    }

    function buildMemberPanel(group, allGroups) {
        const panel = global.document.createElement('div');
        panel.className = 'age-army-groups-members-panel';
        panel.id = `age-army-members-${group.id}`;
        panel.hidden = !expandedGroupIds.has(group.id);

        const list = global.document.createElement('ul');
        list.className = 'age-army-groups-members-list';

        (group.members || []).forEach((member) => {
            const item = global.document.createElement('li');
            item.className = 'age-army-groups-member-item';
            if (member.isSelf) item.classList.add('is-self');

            const label = global.document.createElement('span');
            label.className = 'age-army-groups-member-label';
            label.textContent = `${formatMemberLabel(member)} · Rank ${member.rank || 1}`;
            item.appendChild(label);

            const actions = global.document.createElement('div');
            actions.className = 'age-army-groups-member-actions';

            if (group.canNationCommand && !group.isCommandPost && !member.isLeader) {
                const escortCheck = global.document.createElement('input');
                escortCheck.type = 'checkbox';
                escortCheck.className = 'age-army-groups-escort-check';
                escortCheck.dataset.escortMember = member.username;
                escortCheck.dataset.escortSource = group.id;
                escortCheck.setAttribute('aria-label', `Select ${member.username} for escort`);
                actions.appendChild(escortCheck);
            }

            const viewBtn = global.document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'age-army-groups-member-btn';
            viewBtn.textContent = 'View army';
            viewBtn.dataset.armyView = member.username;
            actions.appendChild(viewBtn);

            if (group.canManageMembers && !member.isLeader) {
                const kickBtn = global.document.createElement('button');
                kickBtn.type = 'button';
                kickBtn.className = 'age-army-groups-member-btn age-army-groups-member-btn--danger';
                kickBtn.textContent = 'Kick';
                kickBtn.dataset.armyKick = group.id;
                kickBtn.dataset.armyKickTarget = member.username;
                actions.appendChild(kickBtn);
            }

            item.appendChild(actions);
            list.appendChild(item);
        });

        panel.appendChild(list);

        if (group.canManageMembers) {
            const mergeBar = global.document.createElement('div');
            mergeBar.className = 'age-army-groups-panel-bar';
            const mergeLabel = global.document.createElement('span');
            mergeLabel.className = 'age-army-groups-panel-bar-label';
            mergeLabel.textContent = 'Merge this army into';
            mergeBar.appendChild(mergeLabel);

            const mergeSelect = global.document.createElement('select');
            mergeSelect.className = 'age-army-groups-panel-select';
            mergeSelect.dataset.mergeTargetFor = group.id;
            const defaultOpt = global.document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Choose army…';
            mergeSelect.appendChild(defaultOpt);
            listMergeTargetGroups(allGroups, group.id).forEach((target) => {
                const opt = global.document.createElement('option');
                opt.value = target.id;
                opt.textContent = `${TYPE_LABELS[target.type] || target.type} — ${target.name}`;
                mergeSelect.appendChild(opt);
            });
            mergeBar.appendChild(mergeSelect);

            const mergeBtn = global.document.createElement('button');
            mergeBtn.type = 'button';
            mergeBtn.className = 'age-army-groups-panel-btn';
            mergeBtn.textContent = 'Merge';
            mergeBtn.dataset.armyMerge = group.id;
            mergeBar.appendChild(mergeBtn);
            panel.appendChild(mergeBar);
        }

        if (group.canNationCommand && !group.isCommandPost) {
            const escortBar = global.document.createElement('div');
            escortBar.className = 'age-army-groups-panel-bar';
            const escortLabel = global.document.createElement('span');
            escortLabel.className = 'age-army-groups-panel-bar-label';
            escortLabel.textContent = 'Escort selected to';
            escortBar.appendChild(escortLabel);

            const escortSelect = global.document.createElement('select');
            escortSelect.className = 'age-army-groups-panel-select';
            escortSelect.dataset.escortTargetFor = group.id;
            listCommandPostGroups(allGroups).forEach((target) => {
                const opt = global.document.createElement('option');
                opt.value = target.id;
                opt.textContent = `${TYPE_LABELS[target.type] || target.type} — ${target.name}`;
                escortSelect.appendChild(opt);
            });
            escortBar.appendChild(escortSelect);

            const escortBtn = global.document.createElement('button');
            escortBtn.type = 'button';
            escortBtn.className = 'age-army-groups-panel-btn';
            escortBtn.textContent = 'Escort';
            escortBtn.dataset.armyEscort = group.id;
            escortBar.appendChild(escortBtn);
            panel.appendChild(escortBar);
        }

        if (group.canNationCommand && group.isCommandPost && group.isLeader) {
            const absorbBar = global.document.createElement('div');
            absorbBar.className = 'age-army-groups-panel-bar';
            const absorbLabel = global.document.createElement('span');
            absorbLabel.className = 'age-army-groups-panel-bar-label';
            absorbLabel.textContent = 'Absorb army';
            absorbBar.appendChild(absorbLabel);

            const absorbSelect = global.document.createElement('select');
            absorbSelect.className = 'age-army-groups-panel-select';
            absorbSelect.dataset.absorbSourceFor = group.id;
            const defaultOpt = global.document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Choose army…';
            absorbSelect.appendChild(defaultOpt);
            listAbsorbSourceGroups(allGroups, group.id).forEach((source) => {
                const opt = global.document.createElement('option');
                opt.value = source.id;
                opt.textContent = `${TYPE_LABELS[source.type] || source.type} — ${source.name}`;
                absorbSelect.appendChild(opt);
            });
            absorbBar.appendChild(absorbSelect);

            const absorbBtn = global.document.createElement('button');
            absorbBtn.type = 'button';
            absorbBtn.className = 'age-army-groups-panel-btn';
            absorbBtn.textContent = 'Absorb';
            absorbBtn.dataset.armyAbsorb = group.id;
            absorbBar.appendChild(absorbBtn);
            panel.appendChild(absorbBar);
        }

        if (group.canDismiss) {
            const dismissBar = global.document.createElement('div');
            dismissBar.className = 'age-army-groups-panel-bar age-army-groups-panel-bar--dismiss';
            const dismissBtn = global.document.createElement('button');
            dismissBtn.type = 'button';
            dismissBtn.className = 'age-army-groups-panel-btn age-army-groups-panel-btn--danger';
            dismissBtn.textContent = 'Dismiss group';
            dismissBtn.dataset.armyDismiss = group.id;
            dismissBar.appendChild(dismissBtn);
            panel.appendChild(dismissBar);
        }

        return panel;
    }

    function renderRosterList(payload) {
        if (!els.list) return;
        const groups = Array.isArray(payload?.groups) ? payload.groups : [];
        const knownIds = new Set(groups.map((group) => group.id));
        expandedGroupIds.forEach((id) => {
            if (!knownIds.has(id)) expandedGroupIds.delete(id);
        });
        if (editingNameGroupId && !knownIds.has(editingNameGroupId)) {
            editingNameGroupId = null;
        }

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
            row.dataset.groupId = group.id;
            row.classList.add(`age-army-groups-row--${group.type}`);
            if (group.type === 'main') row.classList.add('age-army-groups-row--featured-main');
            if (group.type === 'temp-main') row.classList.add('age-army-groups-row--featured-temp-main');
            if (group.type === 'taxi') row.classList.add('age-army-groups-row--taxi');
            if (expandedGroupIds.has(group.id)) row.classList.add('is-expanded');

            const head = global.document.createElement('div');
            head.className = 'age-army-groups-row-head';

            head.appendChild(buildTypePill(group.type));
            head.appendChild(buildGroupNameHead(group));

            const tools = global.document.createElement('div');
            tools.className = 'age-army-groups-row-tools';

            if (!group.isMember) {
                const joinBtn = global.document.createElement('button');
                joinBtn.type = 'button';
                joinBtn.className = 'age-army-groups-join-btn';
                joinBtn.textContent = 'Join';
                joinBtn.dataset.armyJoin = group.id;
                tools.appendChild(joinBtn);
            }

            if (group.canRename) {
                if (editingNameGroupId === group.id) {
                    const saveBtn = global.document.createElement('button');
                    saveBtn.type = 'button';
                    saveBtn.className = 'age-army-groups-icon-btn';
                    saveBtn.textContent = 'Save';
                    saveBtn.dataset.armySaveName = group.id;
                    tools.appendChild(saveBtn);

                    const cancelBtn = global.document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'age-army-groups-icon-btn';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.dataset.armyCancelName = group.id;
                    tools.appendChild(cancelBtn);
                } else {
                    const editBtn = global.document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'age-army-groups-icon-btn';
                    editBtn.textContent = 'Edit';
                    editBtn.dataset.armyEditName = group.id;
                    tools.appendChild(editBtn);
                }
            }

            const expandBtn = global.document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'age-army-groups-expand-btn';
            expandBtn.setAttribute('aria-expanded', expandedGroupIds.has(group.id) ? 'true' : 'false');
            expandBtn.setAttribute('aria-controls', `age-army-members-${group.id}`);
            expandBtn.dataset.armyExpand = group.id;
            expandBtn.textContent = '▼';
            tools.appendChild(expandBtn);

            head.appendChild(tools);
            row.appendChild(head);

            const meta = global.document.createElement('p');
            meta.className = 'age-army-groups-row-meta';
            const count = group.memberCount || 0;
            meta.textContent = `${count} player${count === 1 ? '' : 's'}`;
            row.appendChild(meta);

            row.appendChild(buildMemberPanel(group, groups));
            els.list.appendChild(row);
        });

        if (!groups.length) {
            const empty = global.document.createElement('p');
            empty.className = 'age-army-groups-empty';
            empty.textContent = 'There are no army groups yet.';
            els.list.appendChild(empty);
        }

        if (editingNameGroupId) {
            const input = els.list.querySelector(`[data-army-name-input="${editingNameGroupId}"]`);
            input?.focus();
            input?.select();
        }
    }

    function setSfLeadPanelOpen(open) {
        sfLeadPanelOpen = Boolean(open);
        if (!els.volunteersColumn) return;
        els.volunteersColumn.classList.toggle('is-visible', sfLeadPanelOpen);
        els.volunteersColumn.setAttribute('aria-hidden', sfLeadPanelOpen ? 'false' : 'true');
        els.sfLeadBtn?.setAttribute('aria-expanded', sfLeadPanelOpen ? 'true' : 'false');
        els.sfLeadBtn?.setAttribute('aria-controls', 'age-army-groups-volunteers-column');
    }

    function formatVolunteerDisplayName(username) {
        const raw = String(username || '').trim();
        if (!raw) return '';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    function renderSfLeadVolunteers(payload) {
        if (!els.sfLeadList) return;
        const candidates = Array.isArray(payload?.sfLeadCandidates) ? payload.sfLeadCandidates : [];
        const self = resolveUsername().toLowerCase();
        els.sfLeadList.innerHTML = '';

        if (!candidates.length) {
            const empty = global.document.createElement('li');
            empty.className = 'age-army-groups-sf-lead-empty';
            empty.textContent = 'No lead volunteers yet.';
            els.sfLeadList.appendChild(empty);
            return;
        }

        candidates.forEach((username) => {
            const normalized = String(username || '').trim().toLowerCase();
            if (!normalized) return;

            const item = global.document.createElement('li');
            item.className = 'age-army-groups-sf-lead-item';
            if (normalized === self) {
                item.classList.add('is-self');
            }

            const label = global.document.createElement('span');
            label.className = 'age-army-groups-sf-lead-name';
            const display = formatVolunteerDisplayName(username);
            label.textContent = normalized === self ? `${display} (you)` : display;
            item.appendChild(label);
            els.sfLeadList.appendChild(item);
        });
    }

    function updateSfLeadButton(payload) {
        if (!els.sfLeadBtn) return;
        const listed = Boolean(payload?.sfLeadCandidate);
        els.sfLeadBtn.classList.toggle('is-active', listed);
        els.sfLeadBtn.setAttribute('aria-pressed', listed ? 'true' : 'false');
    }

    async function refreshRoster(options = {}) {
        const silent = Boolean(options.silent);
        const username = resolveUsername();
        if (!username) return;

        try {
            const response = await fetch(
                resolveApiUrl(`${API_BASE}?username=${encodeURIComponent(username)}`),
                resolveApiFetchInit()
            );
            const payload = await parseResponse(response);
            rosterPayload = payload;
            accessFlags = {
                canCreateMain: Boolean(payload.access?.canCreateMain),
                canCreateTempMain: Boolean(payload.access?.canCreateTempMain)
            };
            rebuildAllowedTypes();
            applyTypeCycleButton();
            applyRosterPayload(payload);
            syncSonarFromPayload(payload);
            showFeedback('', false);
        } catch (err) {
            if (workspaceOpen) {
                renderRosterList({ groups: [] });
                if (sfLeadPanelOpen) {
                    renderSfLeadVolunteers({ sfLeadCandidates: [] });
                }
            }
            if (!silent && workspaceOpen) {
                showFeedback(formatRosterError(err), true);
            }
        }
    }

    async function postAction(path, body) {
        const username = resolveUsername();
        if (!username) {
            showFeedback('Commander session required.', true);
            return null;
        }
        const response = await fetch(resolveApiUrl(path), resolveApiFetchInit({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ...body })
        }));
        return parseResponse(response);
    }

    async function createArmyGroup() {
        if (createInFlight) return;

        const name = String(els.nameInput?.value || '').trim();
        if (!name) {
            showFeedback('Enter a unique army name.', true);
            els.nameInput?.focus();
            return;
        }
        const cityId = resolveCreateCityId();
        if (!cityId) {
            showFeedback('Place your commander on the map before creating an army group.', true);
            return;
        }

        if (warnIfApiUnreachable()) {
            return;
        }

        setCreateSubmitBusy(true);
        showFeedback('Creating army group…', false);

        try {
            const payload = await postAction(`${API_BASE}/create`, {
                type: selectedType,
                name,
                cityId
            });
            if (els.nameInput) els.nameInput.value = '';
            setCreatePanelOpen(false);
            showFeedback(`Created ${TYPE_LABELS[selectedType] || selectedType} army “${name}”.`, false);
            const createdId = payload?.group?.id
                || (Array.isArray(payload?.groups)
                    ? payload.groups.find((group) => group.name === name && group.type === selectedType)?.id
                    : null);
            if (createdId) expandedGroupIds.add(createdId);
            applyRosterPayload(payload);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        } finally {
            setCreateSubmitBusy(false);
        }
    }

    async function joinArmyGroup(groupId) {
        try {
            const payload = await postAction(`${API_BASE}/join`, { groupId });
            expandedGroupIds.add(groupId);
            applyRosterPayload(payload);
            showFeedback('Joined army group.', false);
        } catch (err) {
            showFeedback(err.message || 'Could not join army group.', true);
        }
    }

    function toggleGroupExpanded(groupId) {
        if (expandedGroupIds.has(groupId)) {
            expandedGroupIds.delete(groupId);
        } else {
            expandedGroupIds.add(groupId);
        }
        if (rosterPayload) renderRosterList(rosterPayload);
    }

    function startRenameGroup(groupId) {
        editingNameGroupId = groupId;
        if (rosterPayload) renderRosterList(rosterPayload);
    }

    function cancelRenameGroup() {
        editingNameGroupId = null;
        if (rosterPayload) renderRosterList(rosterPayload);
    }

    async function saveRenameGroup(groupId) {
        const input = els.list?.querySelector(`[data-army-name-input="${groupId}"]`);
        const name = String(input?.value || '').trim();
        if (!name) {
            showFeedback('Enter a name for this army group.', true);
            return;
        }
        try {
            const payload = await postAction(`${API_BASE}/rename`, { groupId, name });
            editingNameGroupId = null;
            applyRosterPayload(payload);
            showFeedback('Army name updated.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    async function dismissArmyGroup(groupId) {
        const confirmed = typeof global.showPortalConfirm === 'function'
            ? await global.showPortalConfirm(
                'Dismiss this army group? All members will be unassigned from the roster.',
                { title: 'Dismiss army', confirmLabel: 'Dismiss', cancelLabel: 'Keep' }
            )
            : global.confirm('Dismiss this army group?');
        if (!confirmed) return;

        try {
            const payload = await postAction(`${API_BASE}/dismiss`, { groupId });
            expandedGroupIds.delete(groupId);
            if (editingNameGroupId === groupId) editingNameGroupId = null;
            applyRosterPayload(payload);
            showFeedback('Army group dismissed.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    async function kickArmyMember(groupId, targetUsername) {
        const confirmed = typeof global.showPortalConfirm === 'function'
            ? await global.showPortalConfirm(
                `Remove ${targetUsername} from this army group?`,
                { title: 'Remove member', confirmLabel: 'Kick', cancelLabel: 'Cancel' }
            )
            : global.confirm(`Remove ${targetUsername}?`);
        if (!confirmed) return;

        try {
            const payload = await postAction(`${API_BASE}/kick`, { groupId, targetUsername });
            applyRosterPayload(payload);
            showFeedback('Member removed from army group.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    function ensureArmyViewModal() {
        if (armyViewModalEl) return armyViewModalEl;

        armyViewModalEl = global.document.createElement('div');
        armyViewModalEl.id = 'age-army-groups-army-modal';
        armyViewModalEl.className = 'age-army-groups-army-modal main-portal-modal-hidden';
        armyViewModalEl.hidden = true;
        armyViewModalEl.setAttribute('role', 'dialog');
        armyViewModalEl.setAttribute('aria-modal', 'true');
        armyViewModalEl.innerHTML = `
            <div class="portal-overlay-modal-bezel age-army-groups-army-bezel bordered-modal-panel">
                <header class="age-army-groups-army-header">
                    <h3 id="age-army-groups-army-title" class="age-army-groups-army-title">Commander army</h3>
                    <button type="button" class="age-army-groups-army-close" data-army-view-close aria-label="Close">×</button>
                </header>
                <div id="age-army-groups-army-body" class="age-army-groups-army-body"></div>
            </div>
        `;
        armyViewModalEl.addEventListener('click', (event) => {
            if (event.target === armyViewModalEl) closeArmyViewModal();
        });
        armyViewModalEl.querySelector('[data-army-view-close]')?.addEventListener('click', closeArmyViewModal);
        global.document.body.appendChild(armyViewModalEl);
        return armyViewModalEl;
    }

    function closeArmyViewModal() {
        if (!armyViewModalEl) return;
        armyViewModalEl.hidden = true;
        armyViewModalEl.classList.add('main-portal-modal-hidden');
        armyViewModalEl.setAttribute('aria-hidden', 'true');
    }

    function renderArmyStacks(ageArmy) {
        const stacks = Array.isArray(ageArmy) ? ageArmy : [];
        if (!stacks.length) {
            return '<p class="age-army-groups-army-empty">No units on record.</p>';
        }
        return `<ul class="age-army-groups-army-stacks">${stacks.map((stack) => {
            const unitId = escapeArmyHtml(stack?.unitId || stack?.id || 'Unit');
            const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
            const injured = Math.max(0, Math.floor(Number(stack?.injuredQty) || 0));
            return `<li><span class="age-army-groups-army-unit">${unitId}</span> <span class="age-army-groups-army-qty">${qty} ready</span>${injured > 0 ? ` <span class="age-army-groups-army-injured">(${injured} injured)</span>` : ''}</li>`;
        }).join('')}</ul>`;
    }

    function openArmyViewModal(data) {
        const modal = ensureArmyViewModal();
        const titleEl = modal.querySelector('#age-army-groups-army-title');
        const bodyEl = modal.querySelector('#age-army-groups-army-body');
        const displayName = formatMemberLabel({ username: data.username });
        if (titleEl) {
            titleEl.textContent = `${displayName} — Rank ${data.rank || 1}`;
        }
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p class="age-army-groups-army-summary">${data.unitsTotal || 0} units · ${data.unitsUninjured || 0} ready for battle</p>
                ${renderArmyStacks(data.ageArmy)}
            `;
        }
        modal.hidden = false;
        modal.classList.remove('main-portal-modal-hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    async function viewMemberArmy(targetUsername) {
        const username = resolveUsername();
        if (!username || !targetUsername) return;
        try {
            const response = await fetch(
                resolveApiUrl(`${API_BASE}/member-army?username=${encodeURIComponent(username)}&targetUsername=${encodeURIComponent(targetUsername)}`),
                resolveApiFetchInit()
            );
            const data = await parseResponse(response);
            openArmyViewModal(data);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    async function mergeGroupInto(sourceGroupId) {
        const select = els.list?.querySelector(`select[data-merge-target-for="${sourceGroupId}"]`);
        const targetGroupId = String(select?.value || '').trim();
        if (!targetGroupId) {
            showFeedback('Choose an army group to merge into.', true);
            return;
        }
        const confirmed = typeof global.showPortalConfirm === 'function'
            ? await global.showPortalConfirm(
                'Merge your army into the selected group? Members above the target leader\'s rank will stay behind.',
                { title: 'Merge armies', confirmLabel: 'Merge', cancelLabel: 'Cancel' }
            )
            : global.confirm('Merge into selected army?');
        if (!confirmed) return;

        try {
            const payload = await postAction(`${API_BASE}/merge-into`, { sourceGroupId, targetGroupId });
            expandedGroupIds.delete(sourceGroupId);
            expandedGroupIds.add(targetGroupId);
            applyRosterPayload(payload);
            showFeedback('Army merge completed.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    async function escortSelectedMembers(sourceGroupId) {
        const targetSelect = els.list?.querySelector(`select[data-escort-target-for="${sourceGroupId}"]`);
        const targetGroupId = String(targetSelect?.value || '').trim();
        if (!targetGroupId) {
            showFeedback('Choose Main or Temp Main to escort players into.', true);
            return;
        }
        const checks = els.list?.querySelectorAll(`input[data-escort-source="${sourceGroupId}"]:checked`) || [];
        const memberUsernames = [...checks].map((el) => el.dataset.escortMember).filter(Boolean);
        if (!memberUsernames.length) {
            showFeedback('Select at least one player to escort.', true);
            return;
        }

        try {
            const payload = await postAction(`${API_BASE}/escort`, {
                sourceGroupId,
                targetGroupId,
                memberUsernames
            });
            applyRosterPayload(payload);
            showFeedback('Players escorted to command post.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    async function absorbIntoCommandPost(targetGroupId) {
        const select = els.list?.querySelector(`select[data-absorb-source-for="${targetGroupId}"]`);
        const sourceGroupId = String(select?.value || '').trim();
        if (!sourceGroupId) {
            showFeedback('Choose an army group to absorb.', true);
            return;
        }
        const confirmed = typeof global.showPortalConfirm === 'function'
            ? await global.showPortalConfirm(
                'Absorb the selected army into your command post? Eligible members transfer by rank.',
                { title: 'Absorb army', confirmLabel: 'Absorb', cancelLabel: 'Cancel' }
            )
            : global.confirm('Absorb selected army?');
        if (!confirmed) return;

        try {
            const payload = await postAction(`${API_BASE}/absorb`, { sourceGroupId, targetGroupId });
            expandedGroupIds.delete(sourceGroupId);
            expandedGroupIds.add(targetGroupId);
            applyRosterPayload(payload);
            showFeedback('Army absorbed into command post.', false);
        } catch (err) {
            showFeedback(formatRosterError(err), true);
        }
    }

    function handleRosterListClick(event) {
        const expandBtn = event.target.closest('[data-army-expand]');
        if (expandBtn) {
            event.preventDefault();
            toggleGroupExpanded(expandBtn.dataset.armyExpand);
            return;
        }

        const joinBtn = event.target.closest('[data-army-join]');
        if (joinBtn) {
            event.preventDefault();
            void joinArmyGroup(joinBtn.dataset.armyJoin);
            return;
        }

        const editBtn = event.target.closest('[data-army-edit-name]');
        if (editBtn) {
            event.preventDefault();
            startRenameGroup(editBtn.dataset.armyEditName);
            return;
        }

        const saveBtn = event.target.closest('[data-army-save-name]');
        if (saveBtn) {
            event.preventDefault();
            void saveRenameGroup(saveBtn.dataset.armySaveName);
            return;
        }

        const cancelBtn = event.target.closest('[data-army-cancel-name]');
        if (cancelBtn) {
            event.preventDefault();
            cancelRenameGroup();
            return;
        }

        const dismissBtn = event.target.closest('[data-army-dismiss]');
        if (dismissBtn) {
            event.preventDefault();
            void dismissArmyGroup(dismissBtn.dataset.armyDismiss);
            return;
        }

        const kickBtn = event.target.closest('[data-army-kick]');
        if (kickBtn) {
            event.preventDefault();
            void kickArmyMember(kickBtn.dataset.armyKick, kickBtn.dataset.armyKickTarget);
            return;
        }

        const viewBtn = event.target.closest('[data-army-view]');
        if (viewBtn) {
            event.preventDefault();
            void viewMemberArmy(viewBtn.dataset.armyView);
            return;
        }

        const mergeBtn = event.target.closest('[data-army-merge]');
        if (mergeBtn) {
            event.preventDefault();
            void mergeGroupInto(mergeBtn.dataset.armyMerge);
            return;
        }

        const escortBtn = event.target.closest('[data-army-escort]');
        if (escortBtn) {
            event.preventDefault();
            void escortSelectedMembers(escortBtn.dataset.armyEscort);
            return;
        }

        const absorbBtn = event.target.closest('[data-army-absorb]');
        if (absorbBtn) {
            event.preventDefault();
            void absorbIntoCommandPost(absorbBtn.dataset.armyAbsorb);
        }
    }

    async function toggleSfLeadCandidate() {
        setSfLeadPanelOpen(true);
        try {
            const payload = await postAction(`${API_BASE}/sf-lead-candidate`, {});
            rosterPayload = payload;
            renderSfLeadVolunteers(payload);
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

        global.setTimeout(() => ring.remove(), 1600);
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
        if (eventsBound) return;
        eventsBound = true;

        els.openBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            setWorkspaceOpen(true);
        });

        els.closeBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            setWorkspaceOpen(false);
        });

        els.backdrop?.addEventListener('click', () => setWorkspaceOpen(false));

        const dialog = els.modal?.querySelector('.age-war-room-dialog');
        dialog?.addEventListener('click', (event) => event.stopPropagation());

        els.workspaceMain?.addEventListener('click', (event) => {
            if (event.target.closest('#age-army-groups-btn-create')) {
                event.preventDefault();
                setCreatePanelOpen(!createPanelOpen);
                showFeedback('', false);
                return;
            }
            if (event.target.closest('#age-army-groups-create-submit')) {
                event.preventDefault();
                void createArmyGroup();
                return;
            }
            if (event.target.closest('#age-army-groups-type-cycle')) {
                event.preventDefault();
                cycleSelectedType(1);
            }
        });

        els.nameInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void createArmyGroup();
            }
        });

        els.sfLeadBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            void toggleSfLeadCandidate();
        });
        els.sonarBtn?.addEventListener('click', () => triggerSonar());
        els.list?.addEventListener('click', handleRosterListClick);

        global.document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && armyViewModalEl && !armyViewModalEl.hidden) {
                closeArmyViewModal();
            }
        });

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
        els.modal = global.document.getElementById('age-war-room-modal');
        els.backdrop = global.document.getElementById('age-war-room-backdrop');
        els.closeBtn = global.document.getElementById('age-war-room-close');
        els.openBtn = global.document.getElementById('age-war-room-open');
        els.workspaceMain = global.document.getElementById('age-army-groups-workspace-main');
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
        els.volunteersColumn = global.document.getElementById('age-army-groups-volunteers-column');
        els.sfLeadList = global.document.getElementById('age-army-groups-sf-lead-list');

        if (!els.modal || !els.workspaceMain) return false;

        setCreatePanelOpen(false);
        setSfLeadPanelOpen(false);
        setWorkspaceOpen(false);

        applyTypeCycleButton();
        bindEvents();
        startRefreshLoop();
        refreshRoster({ silent: true });
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
        isWorkspaceOpen: () => workspaceOpen,
        openWorkspace: () => setWorkspaceOpen(true),
        closeWorkspace: () => setWorkspaceOpen(false),
        toggleWorkspace: () => setWorkspaceOpen(!workspaceOpen)
    };

    init();
})(window);

/**
 * NEXUS — Nation army group roster (Main, Temp Main, Hold, Rally, SF, Taxi).
 */
'use strict';

const ARMY_GROUP_TYPES = Object.freeze([
    'sf',
    'taxi',
    'rally',
    'hold',
    'main',
    'temp-main'
]);

const ARMY_GROUP_TYPE_LABELS = Object.freeze({
    sf: 'SF',
    taxi: 'Taxi',
    rally: 'Rally',
    hold: 'Hold',
    main: 'Main',
    'temp-main': 'TMain'
});

const CATEGORY_ORDER = Object.freeze([
    'main',
    'temp-main',
    'hold',
    'rally',
    'sf',
    'taxi'
]);

const SF_NUMBER_WORDS = Object.freeze({
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12
});

const SONAR_SESSION_MS = 32000;
const SONAR_CYCLE_MS = 10000;
const SONAR_PINGS_PER_CYCLE = 3;
const SONAR_PING_GAP_MS = 900;

function normalizeArmyGroupType(value) {
    const type = String(value || '').trim().toLowerCase();
    return ARMY_GROUP_TYPES.includes(type) ? type : '';
}

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeGroupName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
}

function slugId() {
    return `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultNationArmyGroupsState() {
    return {
        groups: [],
        sfLeadCandidates: [],
        sonarSessions: [],
        updatedAt: null
    };
}

function normalizeSfLeadCandidates(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((entry) => {
        const username = normalizeUsername(entry);
        if (!username || seen.has(username)) return;
        seen.add(username);
        out.push(username);
    });
    return out;
}

function normalizeArmyGroupEntry(raw, fallbackLeader = '') {
    if (!raw || typeof raw !== 'object') return null;
    const type = normalizeArmyGroupType(raw.type);
    const name = normalizeGroupName(raw.name);
    const leaderUsername = normalizeUsername(raw.leaderUsername || fallbackLeader);
    if (!type || !name || !leaderUsername) return null;

    const members = [];
    const seen = new Set([leaderUsername]);
    members.push(leaderUsername);
    if (Array.isArray(raw.memberUsernames)) {
        raw.memberUsernames.forEach((entry) => {
            const member = normalizeUsername(entry);
            if (!member || seen.has(member)) return;
            seen.add(member);
            members.push(member);
        });
    }

    return {
        id: String(raw.id || '').trim() || slugId(),
        type,
        name,
        leaderUsername,
        memberUsernames: members,
        cityId: String(raw.cityId || '').trim().slice(0, 64),
        createdAt: raw.createdAt || new Date().toISOString()
    };
}

function normalizeNationArmyGroupsState(raw) {
    const base = getDefaultNationArmyGroupsState();
    if (!raw || typeof raw !== 'object') return base;

    const groups = [];
    const namesSeen = new Set();
    if (Array.isArray(raw.groups)) {
        raw.groups.forEach((entry) => {
            const normalized = normalizeArmyGroupEntry(entry);
            if (!normalized) return;
            const nameKey = `${normalized.type}:${normalized.name.toLowerCase()}`;
            if (namesSeen.has(nameKey)) return;
            namesSeen.add(nameKey);
            groups.push(normalized);
        });
    }

    const sonarSessions = [];
    if (Array.isArray(raw.sonarSessions)) {
        raw.sonarSessions.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const username = normalizeUsername(entry.username);
            const cityId = String(entry.cityId || '').trim();
            const startedAt = entry.startedAt || null;
            const expiresAt = entry.expiresAt || null;
            if (!username || !cityId || !startedAt || !expiresAt) return;
            sonarSessions.push({ username, cityId, startedAt, expiresAt });
        });
    }

    return {
        groups: sortArmyGroups(groups),
        sfLeadCandidates: normalizeSfLeadCandidates(raw.sfLeadCandidates),
        sonarSessions: pruneSonarSessions(sonarSessions),
        updatedAt: raw.updatedAt || null
    };
}

function pruneSonarSessions(sessions, nowMs = Date.now()) {
    return (sessions || []).filter((session) => {
        const expiresMs = Date.parse(session.expiresAt);
        return Number.isFinite(expiresMs) && expiresMs > nowMs;
    });
}

function extractSfSortKey(name) {
    const text = String(name || '').trim().toLowerCase();
    const digitMatch = text.match(/\b(\d{1,2})\b/);
    if (digitMatch) {
        return { numbered: true, value: Number(digitMatch[1]), name: text };
    }

    const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
    if (wordMatch && SF_NUMBER_WORDS[wordMatch[1]] != null) {
        return { numbered: true, value: SF_NUMBER_WORDS[wordMatch[1]], name: text };
    }

    return { numbered: false, value: 9999, name: text };
}

function compareArmyGroups(a, b) {
    const catA = CATEGORY_ORDER.indexOf(a.type);
    const catB = CATEGORY_ORDER.indexOf(b.type);
    if (catA !== catB) return catA - catB;

    if (a.type === 'sf' && b.type === 'sf') {
        const keyA = extractSfSortKey(a.name);
        const keyB = extractSfSortKey(b.name);
        if (keyA.numbered !== keyB.numbered) {
            return keyA.numbered ? -1 : 1;
        }
        if (keyA.value !== keyB.value) return keyA.value - keyB.value;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt) || keyA.name.localeCompare(keyB.name);
    }

    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sortArmyGroups(groups) {
    return [...(groups || [])].sort(compareArmyGroups);
}

function canUseArmyGroupType(type, access) {
    const normalized = normalizeArmyGroupType(type);
    if (!normalized) return false;
    if (normalized === 'main' || normalized === 'temp-main') {
        return Boolean(access?.leader || access?.viceLeader);
    }
    return true;
}

function cycleArmyGroupType(currentType, access, direction = 1) {
    const allowed = ARMY_GROUP_TYPES.filter((type) => canUseArmyGroupType(type, access));
    if (!allowed.length) return 'sf';
    const current = normalizeArmyGroupType(currentType);
    const idx = Math.max(0, allowed.indexOf(current));
    const nextIdx = (idx + direction + allowed.length) % allowed.length;
    return allowed[nextIdx];
}

function validateCreateArmyGroup({ type, name, access, existingGroups }) {
    const normalizedType = normalizeArmyGroupType(type);
    const normalizedName = normalizeGroupName(name);
    if (!normalizedType) {
        return { errorCode: 'NEXUS-GAME-010', message: 'Army group type is required.' };
    }
    if (!normalizedName || normalizedName.length < 2) {
        return { errorCode: 'NEXUS-GAME-011', message: 'Army group name must be at least 2 characters.' };
    }
    if (!canUseArmyGroupType(normalizedType, access)) {
        return { errorCode: 'NEXUS-GAME-005', message: 'You cannot create that army group type.' };
    }
    const duplicate = (existingGroups || []).some(
        (group) => group.type === normalizedType && group.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
        return { errorCode: 'NEXUS-GAME-012', message: 'An army group with that name already exists for this category.' };
    }
    return { type: normalizedType, name: normalizedName };
}

function buildArmyGroupsApiPayload(state, access, username) {
    const normalized = normalizeNationArmyGroupsState(state);
    const self = normalizeUsername(username);
    return {
        groups: normalized.groups.map((group) => ({
            ...group,
            memberCount: group.memberUsernames.length,
            isMember: self ? group.memberUsernames.includes(self) : false,
            isLeader: self ? group.leaderUsername === self : false
        })),
        sfLeadCandidates: normalized.sfLeadCandidates,
        sfLeadCandidate: self ? normalized.sfLeadCandidates.includes(self) : false,
        activeSonar: pickActiveSonarForNation(normalized.sonarSessions),
        sonarTiming: {
            sessionMs: SONAR_SESSION_MS,
            cycleMs: SONAR_CYCLE_MS,
            pingsPerCycle: SONAR_PINGS_PER_CYCLE,
            pingGapMs: SONAR_PING_GAP_MS
        },
        access: {
            canCreateMain: canUseArmyGroupType('main', access),
            canCreateTempMain: canUseArmyGroupType('temp-main', access),
            leader: Boolean(access?.leader),
            viceLeader: Boolean(access?.viceLeader)
        },
        typeCatalog: ARMY_GROUP_TYPES.map((id) => ({
            id,
            label: ARMY_GROUP_TYPE_LABELS[id],
            restricted: id === 'main' || id === 'temp-main'
        }))
    };
}

function pickActiveSonarForNation(sessions) {
    const active = pruneSonarSessions(sessions);
    if (!active.length) return null;
    return active.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}

function applyCreateArmyGroup(state, { type, name, leaderUsername, cityId }) {
    const normalized = normalizeNationArmyGroupsState(state);
    const entry = normalizeArmyGroupEntry({
        id: slugId(),
        type,
        name,
        leaderUsername,
        cityId,
        memberUsernames: [leaderUsername],
        createdAt: new Date().toISOString()
    });
    if (!entry) {
        return { errorCode: 'NEXUS-GAME-010' };
    }
    const next = {
        ...normalized,
        groups: sortArmyGroups([entry, ...normalized.groups]),
        updatedAt: new Date().toISOString()
    };
    return { state: next, group: entry };
}

function applyJoinArmyGroup(state, { groupId, username }) {
    const normalized = normalizeNationArmyGroupsState(state);
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };

    const idx = normalized.groups.findIndex((group) => group.id === groupId);
    if (idx < 0) return { errorCode: 'NEXUS-GAME-013', message: 'Army group not found.' };

    const target = normalized.groups[idx];
    if (target.memberUsernames.includes(self)) {
        return { state: normalized, group: target, alreadyMember: true };
    }

    const updated = {
        ...target,
        memberUsernames: [...target.memberUsernames, self]
    };
    const groups = normalized.groups.slice();
    groups[idx] = updated;

    return {
        state: {
            ...normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        group: updated
    };
}

function applyToggleSfLeadCandidate(state, username) {
    const normalized = normalizeNationArmyGroupsState(state);
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };

    const candidates = new Set(normalized.sfLeadCandidates);
    let listed = false;
    if (candidates.has(self)) {
        candidates.delete(self);
        listed = false;
    } else {
        candidates.add(self);
        listed = true;
    }

    return {
        state: {
            ...normalized,
            sfLeadCandidates: [...candidates],
            updatedAt: new Date().toISOString()
        },
        listed
    };
}

function applyStartSonar(state, { username, cityId, nowMs = Date.now() }) {
    const normalized = normalizeNationArmyGroupsState(state);
    const self = normalizeUsername(username);
    const city = String(cityId || '').trim();
    if (!self || !city) return { errorCode: 'NEXUS-GEN-002' };

    const activeForUser = normalized.sonarSessions.find((session) => session.username === self);
    if (activeForUser) {
        return { state: normalized, session: activeForUser, alreadyActive: true };
    }

    const session = {
        username: self,
        cityId: city,
        startedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + SONAR_SESSION_MS).toISOString()
    };

    const sonarSessions = [
        session,
        ...normalized.sonarSessions.filter((entry) => entry.username !== self)
    ];

    return {
        state: {
            ...normalized,
            sonarSessions: pruneSonarSessions(sonarSessions, nowMs),
            updatedAt: new Date().toISOString()
        },
        session
    };
}

module.exports = {
    ARMY_GROUP_TYPES,
    ARMY_GROUP_TYPE_LABELS,
    CATEGORY_ORDER,
    SONAR_SESSION_MS,
    SONAR_CYCLE_MS,
    SONAR_PINGS_PER_CYCLE,
    SONAR_PING_GAP_MS,
    normalizeArmyGroupType,
    normalizeNationArmyGroupsState,
    getDefaultNationArmyGroupsState,
    sortArmyGroups,
    canUseArmyGroupType,
    cycleArmyGroupType,
    validateCreateArmyGroup,
    buildArmyGroupsApiPayload,
    applyCreateArmyGroup,
    applyJoinArmyGroup,
    applyToggleSfLeadCandidate,
    applyStartSonar,
    pruneSonarSessions
};

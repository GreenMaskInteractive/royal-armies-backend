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

/** Rescue sonar broadcast duration (30 minutes). */
const SONAR_SESSION_MS = 30 * 60 * 1000;
const SONAR_CYCLE_MS = 8000;
const SONAR_PINGS_PER_CYCLE = 4;
const SONAR_PING_GAP_MS = 700;

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
    if (!normalizedName || normalizedName.length < 1) {
        return { errorCode: 'NEXUS-GAME-011', message: 'Army group name is required.' };
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

function findArmyGroupIndex(state, groupId) {
    const normalized = normalizeNationArmyGroupsState(state);
    const idx = normalized.groups.findIndex((group) => group.id === groupId);
    if (idx < 0) {
        return { errorCode: 'NEXUS-GAME-013', message: 'Army group not found.' };
    }
    return { normalized, idx, group: normalized.groups[idx] };
}

function findArmyGroupContainingMember(state, groupId, memberUsername) {
    const normalized = normalizeNationArmyGroupsState(state);
    const member = normalizeUsername(memberUsername);

    if (groupId) {
        return findArmyGroupIndex(state, groupId);
    }

    if (!member) {
        return { errorCode: 'NEXUS-GEN-002' };
    }

    const idx = normalized.groups.findIndex((group) => group.memberUsernames.includes(member));
    if (idx < 0) {
        return { errorCode: 'NEXUS-GAME-013', message: 'Army group not found.' };
    }

    return { normalized, idx, group: normalized.groups[idx] };
}

function findArmyGroupLedBy(state, leaderUsername) {
    const normalized = normalizeNationArmyGroupsState(state);
    const leader = normalizeUsername(leaderUsername);
    if (!leader) return null;
    return normalized.groups.find((group) => group.leaderUsername === leader) || null;
}

function validateNotAlreadyLeadingGroup(state, leaderUsername) {
    const existing = findArmyGroupLedBy(state, leaderUsername);
    if (existing) {
        return {
            errorCode: 'NEXUS-AGE-028',
            message: 'You already lead an army group. Dismiss it before creating or leading another.'
        };
    }
    return null;
}

function validateRenameArmyGroup({ name, group, existingGroups }) {
    const normalizedName = normalizeGroupName(name);
    if (!normalizedName || normalizedName.length < 1) {
        return { errorCode: 'NEXUS-GAME-011', message: 'Army group name is required.' };
    }
    const duplicate = (existingGroups || []).some(
        (entry) => entry.id !== group.id
            && entry.type === group.type
            && entry.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
        return { errorCode: 'NEXUS-GAME-012', message: 'An army group with that name already exists for this category.' };
    }
    return { name: normalizedName };
}

function rebuildArmyGroupMembers(group, memberUsernames) {
    const members = [];
    const seen = new Set();
    (memberUsernames || []).forEach((entry) => {
        const member = normalizeUsername(entry);
        if (!member || seen.has(member)) return;
        seen.add(member);
        members.push(member);
    });
    if (!members.length) return null;

    let leaderUsername = normalizeUsername(group.leaderUsername);
    if (!members.includes(leaderUsername)) {
        leaderUsername = members[0];
    }

    const ordered = [leaderUsername, ...members.filter((member) => member !== leaderUsername)];
    return {
        ...group,
        leaderUsername,
        memberUsernames: ordered
    };
}

function selectMergeEligibleMembers(memberUsernames, targetGroup, resolveRank) {
    const targetLeaderRank = resolveRank(targetGroup.leaderUsername);
    return (memberUsernames || []).filter((member) => resolveRank(member) <= targetLeaderRank);
}

function isNationCommandAccess(access) {
    return Boolean(access?.leader || access?.viceLeader);
}

function isMainArmyType(type) {
    return type === 'main' || type === 'temp-main';
}

function buildArmyGroupsApiPayload(state, access, username, options = {}) {
    const normalized = normalizeNationArmyGroupsState(state);
    const self = normalizeUsername(username);
    const resolveRank = typeof options.resolveMemberRank === 'function'
        ? options.resolveMemberRank
        : () => 1;
    const nationCommand = isNationCommandAccess(access);

    return {
        groups: normalized.groups.map((group) => {
            const members = group.memberUsernames.map((memberUsername) => ({
                username: memberUsername,
                rank: resolveRank(memberUsername),
                isLeader: memberUsername === group.leaderUsername,
                isSelf: Boolean(self && memberUsername === self)
            }));
            const isGroupLeader = Boolean(self && group.leaderUsername === self);
            return {
                id: group.id,
                type: group.type,
                name: group.name,
                cityId: group.cityId,
                createdAt: group.createdAt,
                leaderUsername: group.leaderUsername,
                leaderRank: resolveRank(group.leaderUsername),
                memberCount: group.memberUsernames.length,
                members,
                isMember: self ? group.memberUsernames.includes(self) : false,
                isLeader: isGroupLeader,
                canRename: isGroupLeader,
                canDismiss: isGroupLeader,
                canManageMembers: isGroupLeader,
                canNationCommand: nationCommand,
                isCommandPost: isMainArmyType(group.type)
            };
        }),
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
        return {
            state: {
                ...normalized,
                sonarSessions: normalized.sonarSessions.filter((entry) => entry.username !== self),
                updatedAt: new Date().toISOString()
            },
            deactivated: true,
            session: null
        };
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
        session,
        activated: true
    };
}

function applyRenameArmyGroup(state, { groupId, username, name }) {
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };

    const lookup = findArmyGroupIndex(state, groupId);
    if (lookup.errorCode) return lookup;

    const { normalized, idx, group } = lookup;
    if (group.leaderUsername !== self) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only the army leader can rename this group.' };
    }

    const validation = validateRenameArmyGroup({
        name,
        group,
        existingGroups: normalized.groups
    });
    if (validation.errorCode) return validation;

    const groups = normalized.groups.slice();
    groups[idx] = { ...group, name: validation.name };

    return {
        state: {
            ...normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        group: groups[idx]
    };
}

function applyDismissArmyGroup(state, { groupId, username }) {
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };

    const lookup = findArmyGroupIndex(state, groupId);
    if (lookup.errorCode) return lookup;

    const { normalized, group } = lookup;
    if (group.leaderUsername !== self) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only the army leader can dismiss this group.' };
    }

    return {
        state: {
            ...normalized,
            groups: normalized.groups.filter((entry) => entry.id !== groupId),
            updatedAt: new Date().toISOString()
        },
        dismissedGroupId: groupId
    };
}

function applyKickArmyGroupMember(state, { groupId, username, targetUsername }) {
    const self = normalizeUsername(username);
    const target = normalizeUsername(targetUsername);
    if (!self || !target) return { errorCode: 'NEXUS-GEN-002' };

    const lookup = findArmyGroupIndex(state, groupId);
    if (lookup.errorCode) return lookup;

    const { normalized, idx, group } = lookup;
    if (group.leaderUsername !== self) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only the army leader can remove members.' };
    }
    if (target === group.leaderUsername) {
        return { errorCode: 'NEXUS-GEN-005', message: 'The army leader cannot be removed while the group exists.' };
    }
    if (!group.memberUsernames.includes(target)) {
        return { errorCode: 'NEXUS-GEN-005', message: 'That commander is not in this army group.' };
    }

    const remaining = group.memberUsernames.filter((member) => member !== target);
    const updated = rebuildArmyGroupMembers(group, remaining);
    const groups = normalized.groups.slice();
    groups[idx] = updated;

    return {
        state: {
            ...normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        group: updated,
        removedUsername: target
    };
}

function applyMergeArmyGroupInto(state, {
    sourceGroupId,
    targetGroupId,
    username,
    resolveRank = () => 1
}) {
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };
    if (sourceGroupId === targetGroupId) {
        return { errorCode: 'NEXUS-GEN-003', message: 'Choose a different army group to merge into.' };
    }

    const sourceLookup = findArmyGroupIndex(state, sourceGroupId);
    if (sourceLookup.errorCode) return sourceLookup;
    const targetLookup = findArmyGroupIndex(sourceLookup.normalized, targetGroupId);
    if (targetLookup.errorCode) return targetLookup;

    const source = sourceLookup.group;
    const target = targetLookup.group;
    if (source.leaderUsername !== self) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only your army leader can merge this group into another.' };
    }

    const moving = selectMergeEligibleMembers(source.memberUsernames, target, resolveRank);
    if (!moving.includes(self)) {
        return {
            errorCode: 'NEXUS-GEN-005',
            message: 'Your rank is too high to merge into that army group.'
        };
    }
    if (!moving.length) {
        return { errorCode: 'NEXUS-GEN-005', message: 'No members qualify to merge into that army group.' };
    }

    const targetMembers = new Set(target.memberUsernames);
    moving.forEach((member) => targetMembers.add(member));
    const targetUpdated = rebuildArmyGroupMembers(target, [...targetMembers]);

    const remaining = source.memberUsernames.filter((member) => !moving.includes(member));
    let groups = sourceLookup.normalized.groups.slice();
    groups[targetLookup.idx] = targetUpdated;

    if (!remaining.length) {
        groups = groups.filter((entry) => entry.id !== sourceGroupId);
    } else {
        const sourceUpdated = rebuildArmyGroupMembers(source, remaining);
        groups[sourceLookup.idx] = sourceUpdated;
    }

    return {
        state: {
            ...sourceLookup.normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        movedCount: moving.length,
        sourceRemoved: !remaining.length
    };
}

function applyEscortMembersToCommandPost(state, {
    sourceGroupId,
    targetGroupId,
    memberUsernames,
    username,
    access
}) {
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };
    if (!isNationCommandAccess(access)) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only the nation leader or vice leader can escort players.' };
    }

    const sourceLookup = findArmyGroupIndex(state, sourceGroupId);
    if (sourceLookup.errorCode) return sourceLookup;
    const targetLookup = findArmyGroupIndex(sourceLookup.normalized, targetGroupId);
    if (targetLookup.errorCode) return targetLookup;

    const source = sourceLookup.group;
    const target = targetLookup.group;
    if (!isMainArmyType(target.type)) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Players can only be escorted to Main or Temp Main.' };
    }
    if (source.id === target.id) {
        return { errorCode: 'NEXUS-GEN-003', message: 'Choose a different source army group.' };
    }

    const requested = [];
    const seen = new Set();
    (Array.isArray(memberUsernames) ? memberUsernames : []).forEach((entry) => {
        const member = normalizeUsername(entry);
        if (!member || seen.has(member)) return;
        if (!source.memberUsernames.includes(member)) return;
        seen.add(member);
        requested.push(member);
    });
    if (!requested.length) {
        return { errorCode: 'NEXUS-GEN-003', message: 'Select at least one player to escort.' };
    }

    const targetMembers = new Set(target.memberUsernames);
    requested.forEach((member) => targetMembers.add(member));
    const targetUpdated = rebuildArmyGroupMembers(target, [...targetMembers]);

    const remaining = source.memberUsernames.filter((member) => !requested.includes(member));
    let groups = sourceLookup.normalized.groups.slice();
    groups[targetLookup.idx] = targetUpdated;

    if (!remaining.length) {
        groups = groups.filter((entry) => entry.id !== sourceGroupId);
    } else {
        groups[sourceLookup.idx] = rebuildArmyGroupMembers(source, remaining);
    }

    return {
        state: {
            ...sourceLookup.normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        escortedCount: requested.length,
        sourceRemoved: !remaining.length
    };
}

function applyAbsorbArmyGroupInto(state, {
    sourceGroupId,
    targetGroupId,
    username,
    access,
    resolveRank = () => 1
}) {
    const self = normalizeUsername(username);
    if (!self) return { errorCode: 'NEXUS-GEN-002' };
    if (!isNationCommandAccess(access)) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Only the nation leader or vice leader can absorb an army group.' };
    }
    if (sourceGroupId === targetGroupId) {
        return { errorCode: 'NEXUS-GEN-003', message: 'Choose a different army group to absorb.' };
    }

    const sourceLookup = findArmyGroupIndex(state, sourceGroupId);
    if (sourceLookup.errorCode) return sourceLookup;
    const targetLookup = findArmyGroupIndex(sourceLookup.normalized, targetGroupId);
    if (targetLookup.errorCode) return targetLookup;

    const source = sourceLookup.group;
    const target = targetLookup.group;
    if (!isMainArmyType(target.type)) {
        return { errorCode: 'NEXUS-GEN-005', message: 'Army groups can only be absorbed into Main or Temp Main.' };
    }
    if (target.leaderUsername !== self) {
        return { errorCode: 'NEXUS-GEN-005', message: 'You must lead the Main or Temp Main army to absorb another group.' };
    }

    const moving = selectMergeEligibleMembers(source.memberUsernames, target, resolveRank);
    if (!moving.length) {
        return { errorCode: 'NEXUS-GEN-005', message: 'No members from that army qualify for absorption.' };
    }

    const targetMembers = new Set(target.memberUsernames);
    moving.forEach((member) => targetMembers.add(member));
    const targetUpdated = rebuildArmyGroupMembers(target, [...targetMembers]);

    const remaining = source.memberUsernames.filter((member) => !moving.includes(member));
    let groups = sourceLookup.normalized.groups.slice();
    groups[targetLookup.idx] = targetUpdated;

    if (!remaining.length) {
        groups = groups.filter((entry) => entry.id !== sourceGroupId);
    } else {
        groups[sourceLookup.idx] = rebuildArmyGroupMembers(source, remaining);
    }

    return {
        state: {
            ...sourceLookup.normalized,
            groups: sortArmyGroups(groups),
            updatedAt: new Date().toISOString()
        },
        absorbedCount: moving.length,
        sourceRemoved: !remaining.length
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
    pruneSonarSessions,
    findArmyGroupIndex,
    validateRenameArmyGroup,
    applyRenameArmyGroup,
    applyDismissArmyGroup,
    applyKickArmyGroupMember,
    applyMergeArmyGroupInto,
    applyEscortMembersToCommandPost,
    applyAbsorbArmyGroupInto,
    isMainArmyType,
    isNationCommandAccess,
    findArmyGroupContainingMember,
    findArmyGroupLedBy,
    validateNotAlreadyLeadingGroup
};

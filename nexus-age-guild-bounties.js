/**
 * NEXUS — Adventurer's Guild player bounties (PvP quests).
 */
'use strict';

const { resolveCommanderGameNationKey } = require('./nexus-age-movement');

const BOUNTY_POOL_SIZE = 7;
const BOUNTY_DURATION_MS = 24 * 60 * 60 * 1000;

const BOUNTY_REWARDS = Object.freeze({
    hunterGold: 100_000,
    hunterChronicleXp: 10_000,
    hunterNationRsd: 50_000,
    targetEvadeGold: 125_000,
    targetEvadeNationRsd: 75_000
});

function normalizeUsername(value) {
    return String(value || '').trim();
}

function normalizeNationKey(value) {
    return String(value || '').trim().toLowerCase();
}

function createBountyId(seed = Date.now()) {
    return `bounty-${Math.floor(Number(seed) || Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBountyEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    const targetUsername = normalizeUsername(raw.targetUsername);
    const targetNation = normalizeNationKey(raw.targetNation);
    const expiresAt = String(raw.expiresAt || '').trim();
    if (!id || !targetUsername || !expiresAt) return null;

    return {
        id,
        targetUsername,
        targetNation,
        placedAt: String(raw.placedAt || raw.createdAt || new Date().toISOString()),
        expiresAt,
        acceptedBy: normalizeUsername(raw.acceptedBy) || null,
        acceptedAt: raw.acceptedAt ? String(raw.acceptedAt) : null,
        alertSentAt: raw.alertSentAt ? String(raw.alertSentAt) : null,
        resolvedAt: raw.resolvedAt ? String(raw.resolvedAt) : null,
        resolution: raw.resolution ? String(raw.resolution).slice(0, 32) : null
    };
}

function normalizeBountyState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const active = Array.isArray(source.active)
        ? source.active.map(normalizeBountyEntry).filter(Boolean)
        : [];
    return {
        active,
        lastRefreshAt: source.lastRefreshAt ? String(source.lastRefreshAt) : null
    };
}

function isBountyExpired(bounty, nowMs = Date.now()) {
    const expiresMs = Date.parse(bounty?.expiresAt || '');
    return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
}

function diplomacyBlocksBountyTargeting(nationA, nationB, context = {}) {
    const a = normalizeNationKey(nationA);
    const b = normalizeNationKey(nationB);
    if (!a || !b || a === b) return true;

    if (typeof context.isAllied === 'function' && context.isAllied(a, b)) {
        return true;
    }

    const pairs = context.acceptedDiplomacyPairs instanceof Set ? context.acceptedDiplomacyPairs : null;
    if (pairs && (pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`))) {
        return true;
    }

    return false;
}

function buildAcceptedDiplomacyPairSet(nationStatesMap = {}) {
    const pairs = new Set();
    Object.values(nationStatesMap || {}).forEach((state) => {
        const diplomacy = state?.diplomacy || {};
        const lists = [diplomacy.incoming, diplomacy.outgoing];
        lists.forEach((rows) => {
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const status = String(row?.status || '').trim().toLowerCase();
                if (status !== 'accepted') return;
                const type = String(row?.type || '').trim().toLowerCase();
                if (!type) return;
                const blocked = type.includes('alliance')
                    || type.includes('nap')
                    || type.includes('non-aggression')
                    || type.includes('nonaggression')
                    || type.includes('enemy')
                    || type.includes('war');
                if (!blocked) return;
                const nation = normalizeNationKey(row?.nation);
                if (!nation) return;
                pairs.add(`*|${nation}`);
            });
        });
    });
    return pairs;
}

function commanderIsBountyEligible(target, hunterNation, context = {}) {
    const username = normalizeUsername(target?.username);
    const targetNation = normalizeNationKey(resolveCommanderGameNationKey(target));
    if (!username || !targetNation) return false;
    if (targetNation === normalizeNationKey(hunterNation)) return false;

    if (diplomacyBlocksBountyTargeting(hunterNation, targetNation, context)) {
        return false;
    }

    return true;
}

function pickBountyTarget(commanders, hunterNation, activeBounties, context = {}) {
    const activeTargets = new Set(
        (Array.isArray(activeBounties) ? activeBounties : [])
            .map((entry) => normalizeUsername(entry?.targetUsername).toLowerCase())
            .filter(Boolean)
    );

    const candidates = (Array.isArray(commanders) ? commanders : []).filter((commander) => {
        const username = normalizeUsername(commander?.username);
        if (!username) return false;
        if (activeTargets.has(username.toLowerCase())) return false;
        return commanderIsBountyEligible(commander, hunterNation, context);
    });

    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function refreshBountyPool(state, commanders, context = {}) {
    const now = new Date();
    const nowMs = now.getTime();
    let active = (state?.active || [])
        .map(normalizeBountyEntry)
        .filter(Boolean)
        .filter((entry) => !entry.resolvedAt && !isBountyExpired(entry, nowMs));

    while (active.length < BOUNTY_POOL_SIZE) {
        const target = pickBountyTarget(commanders, context.referenceNation || '', active, context);
        if (!target) break;

        const placedAt = now.toISOString();
        const expiresAt = new Date(nowMs + BOUNTY_DURATION_MS).toISOString();
        active.push({
            id: createBountyId(nowMs + active.length),
            targetUsername: normalizeUsername(target.username),
            targetNation: normalizeNationKey(resolveCommanderGameNationKey(target)),
            placedAt,
            expiresAt,
            acceptedBy: null,
            acceptedAt: null,
            alertSentAt: null,
            resolvedAt: null,
            resolution: null
        });
    }

    return {
        active: active.slice(0, BOUNTY_POOL_SIZE),
        lastRefreshAt: now.toISOString()
    };
}

function listPublicBounties(state, commander) {
    const nowMs = Date.now();
    const viewer = normalizeUsername(commander?.username).toLowerCase();
    const acceptedBountyId = String(commander?.ageGuildAcceptedBountyId || '').trim();

    return (state?.active || []).map((entry) => {
        const normalized = normalizeBountyEntry(entry);
        if (!normalized) return null;
        const msLeft = Math.max(0, Date.parse(normalized.expiresAt) - nowMs);
        return {
            ...normalized,
            expired: isBountyExpired(normalized, nowMs),
            hoursRemaining: Math.ceil(msLeft / (60 * 60 * 1000)),
            acceptedByYou: acceptedBountyId === normalized.id
                || normalizeUsername(normalized.acceptedBy).toLowerCase() === viewer,
            taken: Boolean(normalized.acceptedBy)
        };
    }).filter(Boolean);
}

function acceptBounty(state, commander, bountyId, context = {}) {
    const username = normalizeUsername(commander?.username);
    if (!username) return { ok: false, errorCode: 'NEXUS-GEN-002' };

    if (commander?.ageGuildAcceptedBountyId) {
        return { ok: false, errorCode: 'NEXUS-AGE-022' };
    }

    const active = (state?.active || []).map(normalizeBountyEntry).filter(Boolean);
    const bounty = active.find((entry) => entry.id === String(bountyId || '').trim());
    if (!bounty || isBountyExpired(bounty)) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    if (bounty.acceptedBy) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    if (normalizeUsername(bounty.targetUsername).toLowerCase() === username.toLowerCase()) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    const hunterNation = normalizeNationKey(resolveCommanderGameNationKey(commander));
    if (diplomacyBlocksBountyTargeting(hunterNation, bounty.targetNation, context)) {
        return { ok: false, errorCode: 'NEXUS-AGE-023', message: 'Diplomatic status blocks this bounty target.' };
    }

    const nextActive = active.map((entry) => {
        if (entry.id !== bounty.id) return entry;
        return {
            ...entry,
            acceptedBy: username,
            acceptedAt: new Date().toISOString()
        };
    });

    return {
        ok: true,
        state: { ...state, active: nextActive },
        bounty: nextActive.find((entry) => entry.id === bounty.id),
        ageGuildAcceptedBountyId: bounty.id,
        alertTargetUsername: bounty.targetUsername
    };
}

function resolveExpiredBounties(state) {
    const nowMs = Date.now();
    const resolved = [];
    const active = [];

    (state?.active || []).forEach((raw) => {
        const entry = normalizeBountyEntry(raw);
        if (!entry) return;
        if (entry.resolvedAt) return;
        if (!isBountyExpired(entry, nowMs)) {
            active.push(entry);
            return;
        }
        resolved.push({
            ...entry,
            resolvedAt: new Date(nowMs).toISOString(),
            resolution: 'evaded'
        });
    });

    return {
        state: { ...state, active },
        resolvedEvaded: resolved
    };
}

function claimBountyPvpVictory(state, commander, targetUsername) {
    const hunter = normalizeUsername(commander?.username);
    const target = normalizeUsername(targetUsername);
    const bountyId = String(commander?.ageGuildAcceptedBountyId || '').trim();
    if (!hunter || !target || !bountyId) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    const active = (state?.active || []).map(normalizeBountyEntry).filter(Boolean);
    const bounty = active.find((entry) => entry.id === bountyId);
    if (!bounty
        || normalizeUsername(bounty.targetUsername).toLowerCase() !== target.toLowerCase()
        || normalizeUsername(bounty.acceptedBy).toLowerCase() !== hunter.toLowerCase()
        || isBountyExpired(bounty)) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    const nextActive = active.filter((entry) => entry.id !== bounty.id);
    return {
        ok: true,
        state: { ...state, active: nextActive },
        bounty: {
            ...bounty,
            resolvedAt: new Date().toISOString(),
            resolution: 'claimed'
        },
        rewards: { ...BOUNTY_REWARDS },
        ageGuildAcceptedBountyId: null
    };
}

module.exports = {
    BOUNTY_POOL_SIZE,
    BOUNTY_DURATION_MS,
    BOUNTY_REWARDS,
    normalizeBountyState,
    buildAcceptedDiplomacyPairSet,
    refreshBountyPool,
    listPublicBounties,
    acceptBounty,
    resolveExpiredBounties,
    claimBountyPvpVictory,
    isBountyExpired
};

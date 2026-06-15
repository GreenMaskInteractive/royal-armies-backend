/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ==========================================
   NEXUS MODULE: CORE & ENVIRONMENT
   ========================================== */

/* --- Section: Dependencies & Database Bootstrap --- */

/* Block 1: Core Module Imports */
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { sendApiError, sendStoreError, storeErrorHttpStatus } = require('./nexus-response-errors');
const { validateRegistrationUsername } = require('./public/nexus-account-validation');
const {
    buildCommanderRegistrationAuditPatch,
    buildCommanderLoginAuditPatch,
    resolveClientIp,
    resolveClientUserAgent
} = require('./nexus-request-audit');
const {
    REPORT_CONTEXT_MAX,
    buildPlayerReportRecord,
    validatePlayerReportSubmission,
    buildPlayerReportAdminMailBody
} = require('./nexus-player-reports');
const {
    parseScreenshotPayload,
    savePlayerReportScreenshot
} = require('./nexus-player-report-screenshot');
const { listErrorCodes } = require('./nexus-error-codes');
const { getDeployStatePayload, SERVER_BOOT_ID } = require('./nexus-deploy-revision');
const {
    buildChatSenderRankMeta,
    buildCommanderRankMeta,
    getCommanderRankDisplayTitle,
    resolveCommanderRankTitleGender
} = require('./nexus-commander-rank-titles');
const {
    calculateNationTreasuryCaptureReward,
    getDefaultNationTreasuryRecord,
    getNationTreasuryRewardRules,
    normalizeNationTreasuryEventType,
    normalizeNationTreasuryRecord,
    normalizePlayersInCityCount,
    buildNationTreasuryRewardMeta
} = require('./nexus-nation-treasury');
const {
    applyMovePointRegen,
    spendMovePoint,
    spendMovePoints,
    validateTravel,
    validateAssault,
    validateTransfer,
    validateBorderTarget,
    classifyBorderRelationship,
    resolveCityHolder,
    resolveCityLoser,
    recordCityCapture,
    resolveDefaultCapitalCityId,
    normalizeCommanderMovementRecord,
    normalizeArmyFocusValue,
    resolveCommanderArmyFocus,
    getDefaultCommanderMovementRecord,
    getMovePointRules,
    setInfiniteMovePointsEnabled,
    buildBorderActionHints,
    getCatalogCity,
    loadCityCatalog,
    resolveCatalogCityId,
    resolveMovementTargetCityId,
    resolveCatalogNationKey,
    TRANSFER_OWNERSHIP_RSD_COST,
    AGE_ALPHA_DEFAULT_MAP_NATION
} = require('./nexus-age-movement');
const {
    isOnboardingNationAllowed,
    isOnboardingRegionAllowed,
    resolveOnboardingNationId,
    getOnboardingOpenConfig
} = require('./nexus-onboarding');
const { buildDevNationSwitchLedgerPatch } = require('./nexus-dev-nation-switch');
const {
    isPortalDirectAgeJoinEnabled,
    buildRandomNationEnrollmentPatch,
    buildDirectAgeJoinMovementRefillRecord,
    resetCommanderRecordPreservingAchievements
} = require('./nexus-age-portal-join');
const {
    AGE_CAMPAIGN_TICK_MS,
    ensureAgeCampaignRecord,
    maybeStartAgeCampaignClock,
    performAllCommanderAccountReset,
    readAgeCampaignFromPortal,
    buildAgeSlugForCampaign,
    formatAgeCampaignDisplayLabel,
    createAgeCampaignLifecycleRunner
} = require('./nexus-age-campaign-lifecycle');
const {
    buildClassOnboardingPatch,
    commanderHasLockedClassChoice,
    normalizeClassPerk1Branch,
    normalizeClassPathCode,
    resolveClassIdFromPath
} = require('./nexus-age-class-onboarding');
const {
    getDefaultNationHeadquartersState,
    normalizeNationHeadquartersState,
    buildHeadquartersWorkspacePayload,
    applyPlanningPatch,
    applyConfirmPlanningPatch,
    applyEditPlanningPatch,
    applyClearPublishedPlanPatch,
    applyResetPlanningPatch,
    buildNationPlanPayload,
    applyVotePatch,
    listWarTargetNations,
    listNationVoteCandidates,
    reconcileHeadquartersElection,
    tryFinalizeElectionFromVotes,
    recordRecognizedWarDeclaration,
    syncWarLedgerRelations,
    NATION_AUTHORITY_RANK,
    NATION_AUTHORITY_MIN_RANK14
} = require('./nexus-age-headquarters');
const {
    buildThreatAssessmentMatrix,
    buildSpyLogsWorkspaceSlice,
    buildHqBountyWorkspaceSlice,
    appendSpyLogs,
    deleteSpyLog,
    forwardSpyLog,
    buildSpyLogsFromCityScouts,
    resolveHqBountyCycle,
    claimHqBountyPvpVictory
} = require('./nexus-age-hq-intel');
const {
    SCOUT_GOLD_COST,
    buildTrueGarrisonIntel,
    buildGarrisonSpyFragment,
    buildPlayerScoutEstimate,
    hasGarrisonSpyForUser,
    appendGarrisonSpy,
    appendPlayerScout,
    compileGarrisonFragments,
    buildWatchtowerWorkspacePayload,
    executeBorderSeizeBattle
} = require('./nexus-age-watchtower');
const {
    applyDispatchAlertPatch,
    getActiveDispatchAlert
} = require('./nexus-age-dispatch-alert');
const { buildAgeRecordsPayload } = require('./nexus-age-records');
const {
    normalizeNationArmyGroupsState,
    getDefaultNationArmyGroupsState,
    validateCreateArmyGroup,
    buildArmyGroupsApiPayload,
    applyCreateArmyGroup,
    applyJoinArmyGroup,
    applyToggleSfLeadCandidate,
    applyStartSonar,
    pruneSonarSessions,
    applyRenameArmyGroup,
    applySetArmyGroupType,
    applyDismissArmyGroup,
    applyKickArmyGroupMember,
    applyMergeArmyGroupInto,
    applyEscortMembersToCommandPost,
    applyAbsorbArmyGroupInto,
    validateNotAlreadyLeadingGroup,
    findArmyGroupLedBy
} = require('./nexus-age-army-groups');
const {
    prepareArmyGroupAttack,
    prepareArmyGroupDefeatForMember,
    buildArmyGroupAssaultCasualtyEstimate
} = require('./nexus-age-army-group-battle');
const {
    buildAgeRosterHudPayload,
    buildCommanderAgeRosterSeedPatch,
    resolveCommanderAgeArmy
} = require('./nexus-age-roster');
const {
    resolveCommanderAgeGold,
    buildCommanderAgeGoldSeedPatch,
    resolveCommanderAgeProvisions,
    buildCommanderAgeProvisionsSeedPatch,
    executeAgeUnitRecruitmentWithBalanceAudit
} = require('./nexus-age-recruitment');
const {
    isAgeLedgerAdminUsername,
    resetAllCommanderAgeArmies,
    buildAdminGoldRestorePatch
} = require('./nexus-age-ledger-admin');
const {
    buildCommanderRankResetLedgerPatch,
    buildCommanderExileResetLedgerPatch,
    canApplyCommanderAgeReset,
    incrementAgeResetUsage
} = require('./nexus-age-commander-reset');
const { buildCommanderAgeGearSeedPatch } = require('./nexus-age-commander-gear');
const {
    buildGuildProgressPayload,
    buildGuildStatePayload,
    executeGuildTrainingBattleWithLedger,
    executeCityAssaultBattleWithLedger,
    executeGuildHeal,
    executeTradeConvoyPurchase,
    buildUnitEvolutionPayload,
    executeUnitRankPromotion,
    executeUnitTierEvolution
} = require('./nexus-age-guild');
const {
    buildGuildHubManifest,
    normalizeSettlementTier,
    isBountyVenueTier
} = require('./nexus-age-guild-hub');
const {
    normalizeBountyState,
    refreshBountyPool,
    listPublicBounties,
    acceptBounty,
    resolveExpiredBounties,
    claimBountyPvpVictory,
    BOUNTY_REWARDS
} = require('./nexus-age-guild-bounties');
const {
    loadBlessedBannersSchema,
    canUnlockEmeraldNode,
    normalizeUnlockedNodeIds
} = require('./nexus-emerald-barrier-skills');
const {
    getTrailerRenderStatusPayload,
    startTrailerRenderJob,
    canStartTrailerRenderFromRequest,
    verifyTrailerRenderSyncSecret,
    writeTrailerRenderRemoteStatus,
    sanitizeTrailerRenderProgressPayload,
} = require('./nexus-trailer-render');

/* Block 2: Environment Path Resolution */
const isProduction = process.env.RENDER === 'true';

if (!isProduction || isPortalDirectAgeJoinEnabled()) {
    setInfiniteMovePointsEnabled(true);
}
const dbPath = isProduction ? '/data/db.json' : path.join(__dirname, 'db.json');

/** Chronicles Battle Pass — dossier read/write gated until server rollout. */
const BATTLE_PASS_SERVER_ENABLED = false;

/* Block 3: Ledger Database Initialization */
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({
    commanders: [],
    portal: {
        maintenanceAlert: {
            active: !isProduction,
            title: isProduction ? 'Scheduled maintenance' : 'Site under active development',
            message: isProduction
                ? ''
                : 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
            windowLabel: isProduction
                ? ''
                : 'Expect occasional downtime until the main site launch is complete.'
        },
        communityChat: {
            lastPurgeAt: null,
            nextMessageId: 1,
            channels: {
                general: [],
                bugs: [],
                gameplay: [],
                help: [],
                offtopic: []
            },
            archive: [],
            restrictionsByUser: {}
        },
        gameChat: {
            nextMessageId: 1,
            channels: {
                system: [],
                global: [],
                country: [],
                alliance: []
            },
            archive: []
        },
        gameAge: {
            activeSlug: 'alpha',
            startedAt: null,
            endedAt: null,
            countryChatClearedAt: null
        },
        nationCouncilBoards: {},
        nationTreasuries: {},
        nationLeadership: {},
        nationHeadquarters: {},
        nationArmyGroups: {},
        playerReports: [],
        trailerRenderStatus: null
    },
    mailbox: {
        messages: [],
        drafts: []
    }
}).write();

const PORTAL_EARLY_ACCESS_MAINTENANCE = {
    active: true,
    title: 'Site under active development',
    message: 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
    windowLabel: 'Expect occasional downtime until the main site launch is complete.'
};

function getPortalMaintenanceAlert() {
    const stored = db.get('portal.maintenanceAlert').value() || {};

    if (stored.dismissed === true) {
        return {
            active: false,
            title: String(stored.title || 'Scheduled maintenance').trim().slice(0, 120),
            message: '',
            windowLabel: '',
            updateImminent: stored.updateImminent === true,
            updateImminentAt: stored.updateImminentAt || null
        };
    }

    const message = String(stored.message || '').trim();
    const windowLabel = String(stored.windowLabel || '').trim();

    return {
        active: true,
        title: String(stored.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title).trim().slice(0, 120),
        message: (message || PORTAL_EARLY_ACCESS_MAINTENANCE.message).slice(0, 600),
        windowLabel: (windowLabel || PORTAL_EARLY_ACCESS_MAINTENANCE.windowLabel).slice(0, 160),
        updateImminent: stored.updateImminent === true,
        updateImminentAt: stored.updateImminentAt || null
    };
}

function clearPortalUpdateImminentFlag() {
    const stored = db.get('portal.maintenanceAlert').value() || {};
    if (!stored.updateImminent) return;
    db.set('portal.maintenanceAlert', {
        ...stored,
        updateImminent: false,
        updateImminentAt: null
    }).write();
}

function setPortalMaintenanceAlert(patch = {}) {
    const stored = db.get('portal.maintenanceAlert').value() || {};
    const next = {
        active: stored.active !== false,
        dismissed: stored.dismissed === true,
        title: stored.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title,
        message: stored.message || '',
        windowLabel: stored.windowLabel || ''
    };

    if (patch.active === false) {
        next.active = false;
        next.dismissed = patch.dismissed !== false;
    } else if (patch.active === true) {
        next.active = true;
        next.dismissed = false;
    }

    if (patch.dismissed === true) {
        next.dismissed = true;
        next.active = false;
    } else if (patch.dismissed === false) {
        next.dismissed = false;
        next.active = true;
    }

    if (patch.title !== undefined) {
        next.title = String(patch.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title).trim().slice(0, 120);
    }
    if (patch.message !== undefined) {
        next.message = String(patch.message || '').trim().slice(0, 600);
    }
    if (patch.windowLabel !== undefined) {
        next.windowLabel = String(patch.windowLabel || '').trim().slice(0, 160);
    }

    if (patch.updateImminent === true) {
        next.updateImminent = true;
        next.updateImminentAt = new Date().toISOString();
    } else if (patch.updateImminent === false) {
        next.updateImminent = false;
        next.updateImminentAt = null;
    }

    if (next.active && !next.message) {
        next.message = PORTAL_EARLY_ACCESS_MAINTENANCE.message;
    }
    if (next.active && !next.windowLabel) {
        next.windowLabel = PORTAL_EARLY_ACCESS_MAINTENANCE.windowLabel;
    }

    db.set('portal.maintenanceAlert', next).write();
    return getPortalMaintenanceAlert();
}

const MAINTENANCE_ALERT_DEV_KEY = process.env.MAINTENANCE_ALERT_DEV_KEY || 'local-dev-maintenance';

/* --- Section: Age Portal live presence (in-memory; no mock accounts) --- */
/** In-game "active" roster window — heartbeats do not extend this; tab close removes the session. */
const AGE_SESSION_ACTIVE_MS = 3 * 60 * 1000;
const PORTAL_BROWSE_ONLINE_TTL_MS = 90 * 1000;
const CHAT_PRESENCE_ACTIVE_MS = 25 * 1000;
const PORTAL_PRESENCE_IDLE_MS = 10 * 60 * 1000;
const HIDDEN_REGISTRATION_USERNAMES = new Set(['testaccount']);
const DEV_BOOTSTRAP_USERNAMES = new Set(['caleb_admin', 'devplayer']);
const ageSessionByUser = new Map();
const portalBrowseSessionByUser = new Map();

function isHiddenRegistrationUsername(username) {
    return HIDDEN_REGISTRATION_USERNAMES.has(String(username || '').trim().toLowerCase());
}

/** Accounts that may load the full ledger recipient roster in Messages (compose ➕ list). */
function isMailboxRecipientRosterAdmin(username) {
    return String(username || '').trim().toLowerCase() === 'caleb_admin';
}

/** Portal owner — full Council Room / HQ access in every environment. */
function isHeadquartersOwnerBypass(username) {
    return isMailboxRecipientRosterAdmin(username);
}

/** @deprecated Use isHeadquartersOwnerBypass — kept for call-site clarity. */
function isLocalDevOwnerLeadershipBypass(username) {
    return isHeadquartersOwnerBypass(username);
}

/* --- Section: Community chat (ledger-backed, 100 active per channel, 15-day purge) --- */
const COMMUNITY_CHAT_CHANNEL_IDS = ['general', 'bugs', 'gameplay', 'help', 'offtopic'];
const COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL = 100;
const COMMUNITY_CHAT_PURGE_EVERY_MS = 15 * 24 * 60 * 60 * 1000;
const COMMUNITY_CHAT_TEXT_MAX = 1200;
const COMMUNITY_CHAT_ARCHIVE_MAX = 50000;
const ROYAL_GUARD_BOT_SENDER = 'Royal Guard Bot';
const COMMUNITY_CHAT_MUTE_MS = 30 * 60 * 1000;
const COMMUNITY_CHAT_BAN_MS = 15 * 24 * 60 * 60 * 1000;
const GAME_CHAT_GLOBAL_COMMUNITY_CHANNEL = 'general';

function isRoyalGuardBotSender(sender) {
    return String(sender || '').trim().toLowerCase() === ROYAL_GUARD_BOT_SENDER.toLowerCase();
}

const GAME_CHAT_CHANNEL_IDS = ['system', 'global', 'country', 'alliance'];
const GAME_CHAT_UI_TABS = new Set([...GAME_CHAT_CHANNEL_IDS, 'music']);
const GAME_CHAT_TEXT_MAX = 500;
const GAME_CHAT_MAX_PER_CHANNEL = 300;
const GAME_CHAT_ARCHIVE_MAX = 10000;

function isCommunityChatChannelId(channelId) {
    return COMMUNITY_CHAT_CHANNEL_IDS.includes(String(channelId || '').trim());
}

function normalizeCommunityChatReplyTo(replyTo) {
    if (!replyTo || typeof replyTo !== 'object') return null;
    const sender = String(replyTo.sender || '').trim().slice(0, 80);
    if (!sender) return null;
    return {
        id: Number.isFinite(Number(replyTo.id)) ? Number(replyTo.id) : null,
        sender,
        snippet: String(replyTo.snippet || '').trim().slice(0, 220)
    };
}

function sanitizeCommunityChatMessageEntry(raw = {}) {
    const sentAt = raw.sentAt || raw.createdAt || new Date().toISOString();
    const time = String(raw.time || '').trim().slice(0, 12)
        || new Date(sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    return {
        id: Number(raw.id),
        channel: isCommunityChatChannelId(raw.channel) ? raw.channel : 'general',
        sender: String(raw.sender || '').trim().slice(0, 80),
        text: String(raw.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX),
        time,
        sentAt,
        visible: raw.visible !== false,
        originalText: String(raw.originalText || raw.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX),
        recipientAlertOnly: raw.recipientAlertOnly === true,
        replyTo: normalizeCommunityChatReplyTo(raw.replyTo),
        isEdited: raw.isEdited === true,
        editedAt: raw.editedAt ? String(raw.editedAt).slice(0, 32) : null,
        ...sanitizeChatSenderRankMeta(raw)
    };
}

function sanitizeChatSenderRankMeta(raw = {}) {
    const rank = Math.floor(Number(raw.senderRank));
    if (!Number.isFinite(rank) || rank < 1 || rank > 22) {
        return {};
    }
    return {
        senderRank: rank,
        senderPath: String(raw.senderPath || 'PHYS').trim().slice(0, 16) || 'PHYS',
        senderRankTitleGender: resolveCommanderRankTitleGender(raw.senderRankTitleGender)
    };
}

function normalizeCommunityChatStore(stored) {
    const channels = {};
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const rows = Array.isArray(stored?.channels?.[channelId]) ? stored.channels[channelId] : [];
        channels[channelId] = rows
            .map(sanitizeCommunityChatMessageEntry)
            .filter((row) => Number.isFinite(row.id) && row.sender && row.text);
    });

    const archive = Array.isArray(stored?.archive) ? stored.archive : [];

    const restrictionsByUser = {};
    const rawRestrictions = stored?.restrictionsByUser;
    if (rawRestrictions && typeof rawRestrictions === 'object') {
        Object.keys(rawRestrictions).forEach((usernameKey) => {
            const row = rawRestrictions[usernameKey];
            if (!row || typeof row !== 'object') return;
            const key = String(usernameKey || '').trim().toLowerCase();
            if (!key) return;
            restrictionsByUser[key] = {
                mutedUntil: row.mutedUntil ? String(row.mutedUntil) : null,
                bannedUntil: row.bannedUntil ? String(row.bannedUntil) : null
            };
        });
    }

    return {
        lastPurgeAt: stored?.lastPurgeAt ? String(stored.lastPurgeAt) : null,
        nextMessageId: Math.max(1, parseInt(stored?.nextMessageId, 10) || 1),
        channels,
        archive: archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX),
        restrictionsByUser
    };
}

function getCommunityChatRestrictionsRow(store, username) {
    const key = String(username || '').trim().toLowerCase();
    if (!key) return { mutedUntil: null, bannedUntil: null };
    const row = store.restrictionsByUser?.[key];
    if (!row) return { mutedUntil: null, bannedUntil: null };
    return {
        mutedUntil: row.mutedUntil ? String(row.mutedUntil) : null,
        bannedUntil: row.bannedUntil ? String(row.bannedUntil) : null
    };
}

function getCommunityChatRestrictionBlock(username, store) {
    const row = getCommunityChatRestrictionsRow(store, username);
    const now = Date.now();
    const bannedMs = Date.parse(row.bannedUntil || '');
    if (Number.isFinite(bannedMs) && bannedMs > now) {
        return { errorCode: 'CHAT_USER_BANNED', until: row.bannedUntil };
    }
    const mutedMs = Date.parse(row.mutedUntil || '');
    if (Number.isFinite(mutedMs) && mutedMs > now) {
        return { errorCode: 'CHAT_USER_MUTED', until: row.mutedUntil };
    }
    return null;
}

function serializeCommunityChatRestrictionsForClient(username, store) {
    const row = getCommunityChatRestrictionsRow(store, username);
    const block = getCommunityChatRestrictionBlock(username, store);
    return {
        mutedUntil: row.mutedUntil,
        bannedUntil: row.bannedUntil,
        active: block
            ? { type: block.errorCode === 'CHAT_USER_BANNED' ? 'ban' : 'mute', until: block.until }
            : null
    };
}

function applyCommunityChatRestrictionToStore(store, targetUsername, action) {
    const key = String(targetUsername || '').trim().toLowerCase();
    if (!key) {
        return { errorCode: 'CHAT_RESTRICTION_TARGET_REQUIRED' };
    }

    const now = Date.now();
    const nextRestrictions = { ...(store.restrictionsByUser || {}) };
    const row = { ...getCommunityChatRestrictionsRow(store, key) };

    switch (String(action || '').trim().toLowerCase()) {
        case 'mute':
            row.mutedUntil = new Date(now + COMMUNITY_CHAT_MUTE_MS).toISOString();
            break;
        case 'ban':
            row.bannedUntil = new Date(now + COMMUNITY_CHAT_BAN_MS).toISOString();
            break;
        case 'clear_mute':
            row.mutedUntil = null;
            break;
        case 'clear_ban':
            row.bannedUntil = null;
            break;
        default:
            return { errorCode: 'CHAT_RESTRICTION_ACTION_INVALID' };
    }

    nextRestrictions[key] = row;
    store.restrictionsByUser = nextRestrictions;
    return {
        targetUsername: key,
        restrictions: serializeCommunityChatRestrictionsForClient(key, store)
    };
}

function readCommunityChatStore() {
    const stored = db.get('portal.communityChat').value();
    const normalized = normalizeCommunityChatStore(stored || {});
    if (!stored) {
        db.set('portal.communityChat', normalized).write();
    }
    return normalized;
}

function writeCommunityChatStore(store) {
    const next = normalizeCommunityChatStore(store);
    db.set('portal.communityChat', next).write();
    return next;
}

function archiveCommunityChatMessage(message, reason) {
    return {
        ...sanitizeCommunityChatMessageEntry(message),
        archivedAt: new Date().toISOString(),
        archiveReason: reason === 'scheduled_purge' ? 'scheduled_purge' : 'cap_trim'
    };
}

function trimCommunityChatChannelToCap(store, channelId) {
    const list = store.channels[channelId];
    while (list.length > COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL) {
        const removed = list.shift();
        store.archive.push(archiveCommunityChatMessage(removed, 'cap_trim'));
    }
    if (store.archive.length > COMMUNITY_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX);
    }
}

function maybeRunScheduledCommunityChatPurge(store) {
    const now = Date.now();
    if (!store.lastPurgeAt) {
        store.lastPurgeAt = new Date(now).toISOString();
        return store;
    }

    const lastMs = Date.parse(store.lastPurgeAt);
    if (!Number.isFinite(lastMs) || now - lastMs < COMMUNITY_CHAT_PURGE_EVERY_MS) {
        return store;
    }

    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const list = store.channels[channelId];
        while (list.length) {
            const removed = list.shift();
            store.archive.push(archiveCommunityChatMessage(removed, 'scheduled_purge'));
        }
    });

    if (store.archive.length > COMMUNITY_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX);
    }

    store.lastPurgeAt = new Date(now).toISOString();
    return store;
}

function getCommunityChatRetentionMeta(store) {
    const lastMs = store.lastPurgeAt ? Date.parse(store.lastPurgeAt) : Date.now();
    const nextPurgeMs = (Number.isFinite(lastMs) ? lastMs : Date.now()) + COMMUNITY_CHAT_PURGE_EVERY_MS;
    return {
        maxActivePerChannel: COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL,
        purgeIntervalDays: 15,
        lastPurgeAt: store.lastPurgeAt,
        nextPurgeAt: new Date(nextPurgeMs).toISOString()
    };
}

function flattenCommunityChatActiveMessages(store) {
    const rows = [];
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        store.channels[channelId].forEach((entry) => rows.push(entry));
    });
    rows.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    return rows;
}

/** Community messages exposed to in-game Global tab — general channel only. */
function flattenCommunityChatGeneralChannelMessages(store) {
    const rows = (store.channels[GAME_CHAT_GLOBAL_COMMUNITY_CHANNEL] || []).slice();
    rows.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    return rows;
}

function appendCommunityChatMessageToStore(store, payload) {
    const channel = isCommunityChatChannelId(payload.channel) ? payload.channel : 'general';
    const sender = String(payload.sender || '').trim().slice(0, 80);
    const text = String(payload.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX);

    if (!sender || !text) {
        return { errorCode: 'CHAT_SENDER_TEXT_REQUIRED' };
    }

    const poster = String(payload.posterUsername || payload.username || '').trim().toLowerCase();
    const senderKey = sender.toLowerCase();
    const isBot = isRoyalGuardBotSender(sender);
    const isModerator = isMailboxRecipientRosterAdmin(poster);
    const isDisciplinaryNotice = payload.disciplinaryNotice === true && isModerator;

    if (isBot && payload.systemBot !== true) {
        return { errorCode: 'CHAT_BOT_AUTH_REQUIRED' };
    }

    if (!isBot && !isDisciplinaryNotice && poster && poster !== senderKey) {
        return { errorCode: 'CHAT_SENDER_MISMATCH' };
    }

    if (!isBot && poster) {
        const restrictionBlock = getCommunityChatRestrictionBlock(poster, store);
        if (restrictionBlock) {
            return restrictionBlock;
        }
    }

    const replyTo = normalizeCommunityChatReplyTo(payload.replyTo);
    if (replyTo && !isBot) {
        const replySenderKey = String(replyTo.sender || '').trim().toLowerCase();
        if (replySenderKey && replySenderKey === senderKey) {
            return { errorCode: 'CHAT_SELF_REPLY' };
        }
    }

    const entry = sanitizeCommunityChatMessageEntry({
        id: store.nextMessageId++,
        channel,
        sender,
        text,
        time: payload.time,
        sentAt: new Date().toISOString(),
        visible: isDisciplinaryNotice ? payload.visible === true : payload.visible !== false,
        originalText: payload.originalText || text,
        recipientAlertOnly: isDisciplinaryNotice && payload.recipientAlertOnly === true,
        replyTo,
        isEdited: false,
        editedAt: null,
        ...sanitizeChatSenderRankMeta(payload)
    });

    store.channels[channel].push(entry);
    trimCommunityChatChannelToCap(store, channel);
    return { entry, channelMessages: store.channels[channel] };
}

function updateCommunityChatMessageInStore(store, messageId, posterUsername, patch) {
    const id = Number(messageId);
    if (!Number.isFinite(id)) {
        return { errorCode: 'CHAT_INVALID_MESSAGE_ID' };
    }

    const poster = String(posterUsername || '').trim().toLowerCase();
    const text = String(patch.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX);
    if (!text) {
        return { errorCode: 'CHAT_EMPTY_MESSAGE' };
    }

    for (const channelId of COMMUNITY_CHAT_CHANNEL_IDS) {
        const list = store.channels[channelId];
        const index = list.findIndex((row) => row.id === id);
        if (index === -1) continue;

        const row = list[index];
        if (String(row.sender || '').trim().toLowerCase() !== poster) {
            return { errorCode: 'CHAT_EDIT_OWN_ONLY' };
        }

        const editedAt = new Date().toISOString();
        row.text = text;
        row.originalText = text;
        row.isEdited = true;
        row.editedAt = new Date(editedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        row.sentAt = editedAt;

        return { entry: row, channelMessages: list };
    }

    return { errorCode: 'CHAT_MESSAGE_NOT_FOUND' };
}

function isGameChatChannelId(channelId) {
    return GAME_CHAT_CHANNEL_IDS.includes(String(channelId || '').trim());
}

function sanitizeGameChatMessageEntry(raw = {}) {
    const sentAt = raw.sentAt || new Date().toISOString();
    const time = String(raw.time || '').trim().slice(0, 12)
        || new Date(sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const channel = isGameChatChannelId(raw.channel) ? raw.channel : 'global';

    return {
        id: Number(raw.id),
        channel,
        sender: String(raw.sender || '').trim().slice(0, 80),
        text: String(raw.text || '').trim().slice(0, GAME_CHAT_TEXT_MAX),
        time,
        sentAt,
        source: raw.source === 'system' ? 'system' : 'game',
        nationKey: String(raw.nationKey || '').trim().slice(0, 80) || null,
        allianceId: String(raw.allianceId || '').trim().slice(0, 80) || null,
        ...sanitizeChatSenderRankMeta(raw)
    };
}

function normalizeGameChatStore(stored) {
    const channels = {};
    GAME_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const rows = Array.isArray(stored?.channels?.[channelId]) ? stored.channels[channelId] : [];
        channels[channelId] = rows
            .map(sanitizeGameChatMessageEntry)
            .filter((row) => Number.isFinite(row.id) && row.sender && row.text);
    });

    return {
        nextMessageId: Math.max(1, parseInt(stored?.nextMessageId, 10) || 1),
        channels,
        archive: Array.isArray(stored?.archive) ? stored.archive.slice(-GAME_CHAT_ARCHIVE_MAX) : []
    };
}

function readGameChatStore() {
    const stored = db.get('portal.gameChat').value();
    const normalized = normalizeGameChatStore(stored || {});
    if (!stored) {
        db.set('portal.gameChat', normalized).write();
    }
    return normalized;
}

function writeGameChatStore(store) {
    const next = normalizeGameChatStore(store);
    db.set('portal.gameChat', next).write();
    return next;
}

function normalizeOfficialAgeSlug(value) {
    const slug = String(value || 'alpha').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return slug || 'alpha';
}

function readPortalGameAgeMeta() {
    const stored = db.get('portal.gameAge').value() || {};
    return {
        activeSlug: normalizeOfficialAgeSlug(stored.activeSlug || 'alpha'),
        startedAt: stored.startedAt ? String(stored.startedAt) : null,
        endedAt: stored.endedAt ? String(stored.endedAt) : null,
        countryChatClearedAt: stored.countryChatClearedAt ? String(stored.countryChatClearedAt) : null
    };
}

function writePortalGameAgeMeta(meta) {
    db.set('portal.gameAge', {
        activeSlug: normalizeOfficialAgeSlug(meta?.activeSlug || 'alpha'),
        startedAt: meta?.startedAt || null,
        endedAt: meta?.endedAt || null,
        countryChatClearedAt: meta?.countryChatClearedAt || null
    }).write();
}

function formatOfficialAgeLabel(ageSlug) {
    const slug = normalizeOfficialAgeSlug(ageSlug);
    if (slug === 'alpha') return 'Age Alpha';
    const betaMatch = slug.match(/^beta-(\d+)$/);
    if (betaMatch) return `Age: Beta ${betaMatch[1]}`;
    if (/^\d+$/.test(slug)) return `Age ${slug}`;
    return `Age ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
}

function wipeGameChatCountryChannel(store, archiveReason = 'age_transition') {
    const removed = store.channels.country.splice(0);
    removed.forEach((message) => {
        store.archive.push({
            ...sanitizeGameChatMessageEntry(message),
            archivedAt: new Date().toISOString(),
            archiveReason
        });
    });

    if (store.archive.length > GAME_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-GAME_CHAT_ARCHIVE_MAX);
    }

    return removed.length;
}

function prepareCountryChatForAgeStart(ageSlug) {
    const nextSlug = normalizeOfficialAgeSlug(ageSlug);
    const meta = readPortalGameAgeMeta();
    let store = readGameChatStore();
    store = ensureGameChatSeedMessages(store);

    if (meta.activeSlug === nextSlug) {
        return { wiped: 0, ageSlug: nextSlug, slugChanged: false };
    }

    const wiped = wipeGameChatCountryChannel(store, 'age_slug_change');
    appendGameChatSystemEventToStore(
        store,
        `Country chat cleared — ${formatOfficialAgeLabel(nextSlug)} has begun.`
    );
    writeGameChatStore(store);
    writePortalGameAgeMeta({
        activeSlug: nextSlug,
        startedAt: new Date().toISOString(),
        endedAt: null,
        countryChatClearedAt: new Date().toISOString()
    });

    console.log(`[NEXUS] Country chat wiped for new age (${meta.activeSlug} → ${nextSlug}), removed ${wiped} message(s).`);
    return { wiped, ageSlug: nextSlug, slugChanged: true };
}

function finalizeCountryChatForAgeEnd() {
    let store = readGameChatStore();
    const pendingCount = (store.channels.country || []).length;
    const clearedAt = new Date().toISOString();
    const meta = readPortalGameAgeMeta();

    if (!pendingCount) {
        writePortalGameAgeMeta({
            ...meta,
            endedAt: clearedAt,
            countryChatClearedAt: meta.countryChatClearedAt || clearedAt
        });
        return 0;
    }

    const wiped = wipeGameChatCountryChannel(store, 'age_ended');
    appendGameChatSystemEventToStore(store, 'Country chat cleared — the age has ended.');
    writeGameChatStore(store);
    writePortalGameAgeMeta({
        ...meta,
        endedAt: clearedAt,
        countryChatClearedAt: clearedAt
    });

    console.log(`[NEXUS] Country chat wiped at age end, removed ${wiped} message(s).`);
    return wiped;
}

function maybeFinalizeCountryChatAfterAgeVacant() {
    const activeSessions = [...ageSessionByUser.keys()].filter((username) => !isHiddenRegistrationUsername(username));
    if (activeSessions.length > 0) return 0;
    return finalizeCountryChatForAgeEnd();
}

function trimGameChatChannelToCap(store, channelId) {
    const list = store.channels[channelId];
    while (list.length > GAME_CHAT_MAX_PER_CHANNEL) {
        const removed = list.shift();
        store.archive.push({
            ...sanitizeGameChatMessageEntry(removed),
            archivedAt: new Date().toISOString()
        });
    }
    if (store.archive.length > GAME_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-GAME_CHAT_ARCHIVE_MAX);
    }
}

function appendGameChatSystemEventToStore(store, text) {
    const messageText = String(text || '').trim().slice(0, GAME_CHAT_TEXT_MAX);
    if (!messageText) {
        return { errorCode: 'GAME_SYSTEM_TEXT_REQUIRED' };
    }

    const entry = sanitizeGameChatMessageEntry({
        id: store.nextMessageId++,
        channel: 'system',
        sender: 'System',
        text: messageText,
        sentAt: new Date().toISOString(),
        source: 'system'
    });

    store.channels.system.push(entry);
    trimGameChatChannelToCap(store, 'system');
    return { entry };
}

const COUNCIL_BOARD_STATUS_IDS = [
    'training-permitted',
    'light-training-permitted',
    'stop-training',
    'enemy-bordering',
    'sf-time',
    'rejoin'
];

const COUNCIL_BOARD_STATUS_LABELS = {
    'training-permitted': 'Training Permitted',
    'light-training-permitted': 'Light Training Permitted',
    'stop-training': 'Stop Training',
    'enemy-bordering': 'Enemy Bordering',
    'sf-time': 'SF Time',
    rejoin: 'Rejoin'
};

function isCouncilBoardStatusId(statusId) {
    return COUNCIL_BOARD_STATUS_IDS.includes(statusId);
}

function getDefaultCouncilBoardState() {
    return {
        statusId: 'training-permitted',
        previousStatusId: null,
        noticeText: '',
        nextSfTime: '',
        expectedPvpTime: '',
        updatedAt: null,
        updatedBy: null
    };
}

function normalizeCouncilBoardState(raw = {}) {
    const base = getDefaultCouncilBoardState();
    const statusId = isCouncilBoardStatusId(raw.statusId) ? raw.statusId : base.statusId;
    const previousStatusId = isCouncilBoardStatusId(raw.previousStatusId) ? raw.previousStatusId : null;

    return {
        statusId,
        previousStatusId,
        noticeText: String(raw.noticeText || '').replace(/<[^>]*>/g, '').trim().slice(0, 2000),
        nextSfTime: String(raw.nextSfTime || '').trim().slice(0, 80),
        expectedPvpTime: String(raw.expectedPvpTime || '').trim().slice(0, 80),
        updatedAt: raw.updatedAt || null,
        updatedBy: String(raw.updatedBy || '').trim().slice(0, 80) || null
    };
}

function readNationCouncilBoardsMap() {
    const stored = db.get('portal.nationCouncilBoards').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function writeNationCouncilBoardsMap(map) {
    db.set('portal.nationCouncilBoards', map && typeof map === 'object' ? map : {}).write();
}

function resolveCouncilBoardNationKey(commander) {
    const gameNation = String(commander?.gameNation || '').trim();
    if (gameNation) return gameNation;

    // commander.country is real-world locale (e.g. North America) — not an in-game nation.
    const username = String(commander?.username || '').trim().toLowerCase();
    if (username) return `staging:${username}`;

    return '';
}

function getCouncilBoardStorageKey(nationKey) {
    return String(nationKey || '').trim().toLowerCase();
}

function readCouncilBoardForNation(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) return getDefaultCouncilBoardState();

    const boards = readNationCouncilBoardsMap();
    return normalizeCouncilBoardState(boards[storageKey] || getDefaultCouncilBoardState());
}

function writeCouncilBoardForNation(nationKey, boardState) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const boards = readNationCouncilBoardsMap();
    boards[storageKey] = normalizeCouncilBoardState(boardState);
    writeNationCouncilBoardsMap(boards);
    return { board: boards[storageKey] };
}

function readNationArmyGroupsMap() {
    const stored = db.get('portal.nationArmyGroups').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function writeNationArmyGroupsMap(map) {
    db.set('portal.nationArmyGroups', map && typeof map === 'object' ? map : {}).write();
}

function readNationArmyGroupsForNation(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) return getDefaultNationArmyGroupsState();

    const record = readNationArmyGroupsMap()[storageKey];
    return normalizeNationArmyGroupsState(record);
}

function writeNationArmyGroupsForNation(nationKey, state) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const map = readNationArmyGroupsMap();
    map[storageKey] = normalizeNationArmyGroupsState(state);
    writeNationArmyGroupsMap(map);
    return { state: map[storageKey] };
}

function readNationTreasuriesMap() {
    const stored = db.get('portal.nationTreasuries').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function writeNationTreasuriesMap(map) {
    db.set('portal.nationTreasuries', map && typeof map === 'object' ? map : {}).write();
}

function readNationTreasuryForNation(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) return getDefaultNationTreasuryRecord();

    const treasuries = readNationTreasuriesMap();
    return normalizeNationTreasuryRecord(treasuries[storageKey] || getDefaultNationTreasuryRecord());
}

function readNationAgeRecordsMap() {
    const stored = db.get('portal.ageNationRecords').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function awardNationTreasuryRsd(nationKey, amount, meta = {}) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const grant = Math.max(0, Math.floor(Number(amount) || 0));
    if (!grant) {
        return { errorCode: 'NEXUS-GEN-002' };
    }

    const treasuries = readNationTreasuriesMap();
    const current = normalizeNationTreasuryRecord(treasuries[storageKey] || getDefaultNationTreasuryRecord());
    const next = normalizeNationTreasuryRecord({
        rsd: current.rsd + grant,
        updatedAt: new Date().toISOString()
    });

    treasuries[storageKey] = next;
    writeNationTreasuriesMap(treasuries);

    return {
        treasury: next,
        grantedRsd: grant,
        meta: buildNationTreasuryRewardMeta(meta)
    };
}

function awardNationTreasuryForCaptureEvent(nationKey, eventType, playersInCity, details = {}) {
    const normalizedEvent = normalizeNationTreasuryEventType(eventType);
    if (!normalizedEvent) {
        return { errorCode: 'NEXUS-GEN-002' };
    }

    const players = normalizePlayersInCityCount(playersInCity);
    const grant = calculateNationTreasuryCaptureReward(players);
    return awardNationTreasuryRsd(nationKey, grant, {
        eventType: normalizedEvent,
        playersInCity: players,
        cityId: details.cityId,
        cityName: details.cityName,
        awardedBy: details.awardedBy
    });
}

function debitNationTreasuryRsd(nationKey, amount, meta = {}) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const debit = Math.max(0, Math.floor(Number(amount) || 0));
    if (!debit) {
        return { errorCode: 'NEXUS-GEN-002' };
    }

    const treasuries = readNationTreasuriesMap();
    const current = normalizeNationTreasuryRecord(treasuries[storageKey] || getDefaultNationTreasuryRecord());
    if (current.rsd < debit) {
        return { errorCode: 'NEXUS-AGE-004' };
    }

    const next = normalizeNationTreasuryRecord({
        rsd: current.rsd - debit,
        updatedAt: new Date().toISOString()
    });

    treasuries[storageKey] = next;
    writeNationTreasuriesMap(treasuries);

    return {
        treasury: next,
        debitedRsd: debit,
        meta: buildNationTreasuryRewardMeta({
            ...meta,
            eventType: meta.eventType || 'city-capture'
        })
    };
}

function readAgeMovementStore() {
    const stored = db.get('portal.ageMovement').value();
    const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    return {
        commanders: base.commanders && typeof base.commanders === 'object' ? base.commanders : {},
        cityHolders: base.cityHolders && typeof base.cityHolders === 'object' ? base.cityHolders : {},
        cityLosers: base.cityLosers && typeof base.cityLosers === 'object' ? base.cityLosers : {},
        cityCaptureAt: base.cityCaptureAt && typeof base.cityCaptureAt === 'object' ? base.cityCaptureAt : {}
    };
}

function writeAgeMovementStore(store) {
    db.set('portal.ageMovement', {
        commanders: store.commanders && typeof store.commanders === 'object' ? store.commanders : {},
        cityHolders: store.cityHolders && typeof store.cityHolders === 'object' ? store.cityHolders : {},
        cityLosers: store.cityLosers && typeof store.cityLosers === 'object' ? store.cityLosers : {},
        cityCaptureAt: store.cityCaptureAt && typeof store.cityCaptureAt === 'object' ? store.cityCaptureAt : {}
    }).write();
}

function resolveCommanderStorageUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function resolveNationAllianceId(nationKey) {
    const needle = getCouncilBoardStorageKey(nationKey);
    if (!needle) return '';

    const commanders = db.get('commanders').value() || [];
    for (let index = 0; index < commanders.length; index += 1) {
        const commander = commanders[index];
        const commanderNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
        if (commanderNation !== needle) continue;
        const allianceId = String(commander.allianceId || '').trim().toLowerCase();
        if (allianceId) return allianceId;
    }
    return '';
}

function areNationsAllied(nationA, nationB) {
    const a = getCouncilBoardStorageKey(nationA);
    const b = getCouncilBoardStorageKey(nationB);
    if (!a || !b || a === b) return a === b;
    const allianceA = resolveNationAllianceId(a);
    const allianceB = resolveNationAllianceId(b);
    return Boolean(allianceA && allianceB && allianceA === allianceB);
}

function readCommanderMovementRecord(username, nationKey) {
    const storageUsername = resolveCommanderStorageUsername(username);
    const store = readAgeMovementStore();
    const raw = store.commanders[storageUsername];
    const normalized = normalizeCommanderMovementRecord(raw, nationKey);
    if (
        raw
        && nationKey
        && normalized.catalogCityId
        && String(raw.catalogCityId || '').trim().toLowerCase() !== normalized.catalogCityId
    ) {
        writeCommanderMovementRecord(username, normalized);
    }
    const regen = applyMovePointRegen(normalized);
    return {
        ...normalized,
        movePoints: regen.movePoints,
        lastMovePointRegenAt: regen.lastMovePointRegenAt
    };
}

function writeCommanderMovementRecord(username, record) {
    const storageUsername = resolveCommanderStorageUsername(username);
    const store = readAgeMovementStore();
    store.commanders[storageUsername] = record;
    writeAgeMovementStore(store);
    return record;
}

function clearCommanderMovementRecord(username) {
    const storageUsername = resolveCommanderStorageUsername(username);
    const store = readAgeMovementStore();
    if (store.commanders[storageUsername]) {
        delete store.commanders[storageUsername];
        writeAgeMovementStore(store);
    }
}

function resolveAlliedNationIds(nationKey) {
    const allianceId = resolveNationAllianceId(nationKey);
    if (!allianceId) return [];

    const selfKey = getCouncilBoardStorageKey(nationKey);
    const allied = new Set();
    const commanders = db.get('commanders').value() || [];

    commanders.forEach((commander) => {
        const commanderNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
        const commanderAlliance = String(commander.allianceId || '').trim().toLowerCase();
        if (!commanderNation || commanderNation === selfKey) return;
        if (commanderAlliance && commanderAlliance === allianceId) {
            allied.add(commanderNation);
        }
    });

    return [...allied];
}

function resolveCommanderMapNationKey(commander) {
    const gameNation = resolveCatalogNationKey(commander?.gameNation);
    if (gameNation) return gameNation;
    const council = resolveCatalogNationKey(resolveCouncilBoardNationKey(commander));
    if (council) return council;
    return AGE_ALPHA_DEFAULT_MAP_NATION;
}

function ensureCommanderAgeRoster(commander) {
    if (!commander?.username) {
        return buildAgeRosterHudPayload(null);
    }

    const seedPatch = {
        ...buildCommanderAgeRosterSeedPatch(commander),
        ...buildCommanderAgeGoldSeedPatch(commander),
        ...buildCommanderAgeProvisionsSeedPatch(commander),
        ...buildCommanderAgeGearSeedPatch(commander)
    };
    if (Object.keys(seedPatch).length) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                ...seedPatch,
                ageRosterSeededAt: new Date().toISOString()
            })
            .write();
        commander = db.get('commanders').find({ username: commander.username }).value();
    }

    return buildAgeRosterHudPayload(commander);
}

function buildAgeMovementStatePayload(username, commander) {
    const councilNation = resolveCouncilBoardNationKey(commander);
    const mapNation = resolveCommanderMapNationKey(commander);
    const movement = readCommanderMovementRecord(username, mapNation || councilNation);
    const store = readAgeMovementStore();
    const rules = getMovePointRules();
    const roster = buildAgeRosterHudPayload(commander);
    const guildProgress = buildGuildProgressPayload(commander);

    return {
        gameNation: mapNation,
        mapNation,
        catalogCityId: mapNation ? (movement.catalogCityId || resolveDefaultCapitalCityId(mapNation)) : '',
        movePoints: movement.movePoints,
        movePointsMax: rules.movePointsMax,
        lastMovePointRegenAt: movement.lastMovePointRegenAt,
        cityHolders: store.cityHolders,
        cityLosers: store.cityLosers,
        alliedNationIds: mapNation ? resolveAlliedNationIds(mapNation) : [],
        rules,
        ageGold: resolveCommanderAgeGold(commander),
        ageProvisions: resolveCommanderAgeProvisions(commander),
        rank: guildProgress.rank,
        path: guildProgress.path,
        rankTitleGender: guildProgress.rankTitleGender,
        ageGuildXp: guildProgress.ageGuildXp,
        ageGuildXpRequired: guildProgress.ageGuildXpRequired,
        ageGuildXpProgress: guildProgress.ageGuildXpProgress,
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        ageArmy: roster.ageArmy
    };
}

function getAgeSessionForUsername(username) {
    pruneAgeSessionOnlineState();
    const canonical = resolveLedgerCommanderUsername(username) || normalizeLedgerUsername(username);
    if (!canonical) return null;

    const direct = ageSessionByUser.get(canonical);
    if (direct) return direct;

    const lower = canonical.toLowerCase();
    for (const [key, session] of ageSessionByUser.entries()) {
        if (String(key).toLowerCase() === lower) {
            return session;
        }
    }

    return null;
}

function resolveCatalogNationDisplayName(nationKey) {
    const nationId = resolveCatalogNationKey(nationKey);
    if (!nationId) return '';

    const catalog = loadCityCatalog();
    const nation = (catalog.nations || []).find((entry) => entry.id === nationId);
    return nation?.name ? String(nation.name).trim() : nationId;
}

function resolveCommanderCatalogCityId(commander) {
    const mapNation = resolveCommanderMapNationKey(commander);
    if (!mapNation) return '';

    const username = String(commander?.username || '').trim();
    if (!username) return '';

    const movement = readCommanderMovementRecord(username, mapNation);
    const rawCityId = movement.catalogCityId || resolveDefaultCapitalCityId(mapNation);
    return resolveCatalogCityId(rawCityId, mapNation);
}

function resolveCommanderMovePointsPayload(commander) {
    const rules = getMovePointRules();
    const mapNation = resolveCommanderMapNationKey(commander);
    const username = String(commander?.username || '').trim();
    if (!username || !mapNation) {
        return { movePoints: 0, movePointsMax: rules.movePointsMax };
    }

    const movement = readCommanderMovementRecord(username, mapNation);
    return {
        movePoints: movement.movePoints,
        movePointsMax: rules.movePointsMax
    };
}

function countNationAgeJoinedForces(nationId) {
    const nation = resolveCatalogNationKey(nationId);
    if (!nation) return 0;

    const commanders = db.get('commanders').value() || [];
    let count = 0;

    commanders.forEach((commander) => {
        if (!commander?.username || isHiddenRegistrationUsername(commander.username)) return;

        const mapNation = resolveCommanderMapNationKey(commander);
        if (mapNation !== nation) return;

        if (!getAgeSessionForUsername(commander.username)) return;

        count += 1;
    });

    return count;
}

function buildAgeNationPlayersPayload(nationId, viewerUsername) {
    const nation = resolveCatalogNationKey(nationId);
    if (!nation) {
        return {
            nationId: '',
            nationName: '',
            players: [],
            totalForces: 0,
            onlineCount: 0
        };
    }

    const nationName = resolveCatalogNationDisplayName(nation);
    const commanders = db.get('commanders').value() || [];
    const viewerLower = viewerUsername ? String(viewerUsername).trim().toLowerCase() : '';
    const players = [];

    commanders.forEach((commander) => {
        if (!commander?.username || isHiddenRegistrationUsername(commander.username)) return;

        const mapNation = resolveCommanderMapNationKey(commander);
        if (mapNation !== nation) return;

        const username = String(commander.username).trim();
        const movement = readCommanderMovementRecord(username, mapNation);
        const catalogCityId = movement.catalogCityId || resolveDefaultCapitalCityId(mapNation);
        const city = getCatalogCity(catalogCityId);
        const session = getAgeSessionForUsername(username);

        players.push({
            username,
            displayName: username,
            catalogCityId,
            cityName: city?.name || '',
            online: Boolean(session?.isOnline),
            membershipTitle: resolveCommanderMembershipTitleForLedger(commander),
            isSelf: Boolean(viewerLower && username.toLowerCase() === viewerLower)
        });
    });

    players.sort((left, right) => left.username.localeCompare(
        right.username,
        undefined,
        { sensitivity: 'base' }
    ));

    const onlineCount = players.filter((player) => player.online).length;

    return {
        nationId: nation,
        nationName,
        players,
        totalForces: countNationAgeJoinedForces(nation),
        onlineCount
    };
}

function buildAgeCityPlayersPayload(catalogCityId, viewerUsername) {
    const viewerCommander = viewerUsername
        ? db.get('commanders').find({ username: viewerUsername }).value()
        : null;
    const viewerNation = viewerCommander ? resolveCommanderMapNationKey(viewerCommander) : '';

    let resolvedCityId = resolveCatalogCityId(catalogCityId, viewerNation);
    if (!resolvedCityId && viewerCommander) {
        resolvedCityId = resolveCommanderCatalogCityId(viewerCommander);
    }

    const city = resolvedCityId ? getCatalogCity(resolvedCityId) : null;
    if (!resolvedCityId || !city) {
        const nationForces = viewerNation
            ? countNationAgeJoinedForces(viewerNation)
            : 0;

        return {
            catalogCityId: '',
            cityName: '',
            players: [],
            totalForces: nationForces,
            onlineCount: 0
        };
    }

    const commanders = db.get('commanders').value() || [];
    const viewerLower = viewerUsername ? String(viewerUsername).trim().toLowerCase() : '';
    const players = [];
    const seenUsernames = new Set();

    commanders.forEach((commander) => {
        if (!commander?.username || isHiddenRegistrationUsername(commander.username)) return;

        const username = String(commander.username).trim();
        if (!getAgeSessionForUsername(username)) return;

        const commanderCityId = resolveCommanderCatalogCityId(commander);
        if (commanderCityId !== resolvedCityId) return;

        const session = getAgeSessionForUsername(username);
        const mapNation = resolveCommanderMapNationKey(commander);
        const movePoints = resolveCommanderMovePointsPayload(commander);
        const movement = readCommanderMovementRecord(username, mapNation);
        const armyFocus = resolveCommanderArmyFocus(commander, movement);

        const rankMeta = buildCommanderRankMeta(commander);
        players.push({
            username,
            displayName: username,
            catalogCityId: commanderCityId,
            nationId: mapNation,
            online: Boolean(session?.isOnline),
            membershipTitle: resolveCommanderMembershipTitleForLedger(commander),
            movePoints: movePoints.movePoints,
            armyFocus: armyFocus || null,
            isSelf: Boolean(viewerLower && username.toLowerCase() === viewerLower),
            rank: rankMeta.rank,
            path: rankMeta.path,
            rankTitleGender: rankMeta.rankTitleGender
        });
        seenUsernames.add(username.toLowerCase());
    });

    if (viewerCommander && viewerLower && !seenUsernames.has(viewerLower)) {
        const viewerCityId = resolveCommanderCatalogCityId(viewerCommander);
        const viewerSession = getAgeSessionForUsername(viewerCommander.username);
        if (viewerCityId === resolvedCityId && viewerSession) {
            const movePoints = resolveCommanderMovePointsPayload(viewerCommander);
            const movement = readCommanderMovementRecord(viewerCommander.username, viewerNation);
            const armyFocus = resolveCommanderArmyFocus(viewerCommander, movement);
            const viewerRankMeta = buildCommanderRankMeta(viewerCommander);
            players.push({
                username: viewerCommander.username,
                displayName: viewerCommander.username,
                catalogCityId: viewerCityId,
                nationId: viewerNation,
                online: Boolean(viewerSession.isOnline),
                membershipTitle: String(viewerCommander.membershipTitle || 'Basic').trim() || 'Basic',
                movePoints: movePoints.movePoints,
                armyFocus: armyFocus || null,
                isSelf: true,
                rank: viewerRankMeta.rank,
                path: viewerRankMeta.path,
                rankTitleGender: viewerRankMeta.rankTitleGender
            });
        }
    }

    players.sort((left, right) => left.username.localeCompare(
        right.username,
        undefined,
        { sensitivity: 'base' }
    ));

    const onlineCount = players.filter((player) => player.online).length;
    const nationForces = viewerNation
        ? countNationAgeJoinedForces(viewerNation)
        : 0;

    return {
        catalogCityId: resolvedCityId,
        cityName: city.name || '',
        players,
        totalForces: nationForces,
        onlineCount
    };
}

function buildWatchtowerWorkspaceForCommander(commander, targetCityId) {
    const username = String(commander?.username || '').trim();
    const gameNation = resolveCommanderMapNationKey(commander);
    if (!username || !gameNation) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const cityId = String(targetCityId || '').trim();
    const city = getCatalogCity(cityId);
    if (!city) {
        return { errorCode: 'NEXUS-AGE-003' };
    }

    const movement = readCommanderMovementRecord(username, gameNation);
    const store = readAgeMovementStore();
    const border = validateBorderTarget(movement.catalogCityId, cityId);
    if (border?.errorCode) {
        return { errorCode: border.errorCode === 'NEXUS-AGE-004' ? 'NEXUS-AGE-031' : border.errorCode };
    }

    const relationship = classifyBorderRelationship(
        gameNation,
        border.targetCity,
        store.cityHolders,
        areNationsAllied
    );
    if (relationship === 'own') {
        return { errorCode: 'NEXUS-AGE-010' };
    }

    const nationState = readNationHeadquartersForNation(gameNation);
    const watchtower = nationState.watchtower || {};
    const cityPlayersPayload = buildAgeCityPlayersPayload(cityId, username);
    const commanders = db.get('commanders').value() || [];
    const commandersInCity = commanders.filter((row) => (
        String(row?.username || '').trim()
        && resolveCommanderCatalogCityId(row) === cityId
        && getAgeSessionForUsername(row.username)
    ));

    return {
        workspace: buildWatchtowerWorkspacePayload({
            city,
            cityId,
            players: cityPlayersPayload.players || [],
            watchtower,
            viewerUsername: username,
            viewerGold: resolveCommanderAgeGold(commander),
            canGarrisonSpy: !hasGarrisonSpyForUser(watchtower, cityId, username),
            relationship
        }),
        nationState,
        commandersInCity,
        relationship,
        city
    };
}

function formatCouncilBoardStatusAlert(previousStatusId, nextStatusId, actorUsername) {
    const previousLabel = COUNCIL_BOARD_STATUS_LABELS[previousStatusId] || 'Unknown';
    const nextLabel = COUNCIL_BOARD_STATUS_LABELS[nextStatusId] || 'Unknown';
    const actor = String(actorUsername || '').trim();
    const actorSuffix = actor ? ` (${actor})` : '';
    return `Council status: ${previousLabel} → ${nextLabel}${actorSuffix}`;
}

function appendGameChatNationSystemEventToStore(store, nationKey, text) {
    const messageText = String(text || '').trim().slice(0, GAME_CHAT_TEXT_MAX);
    const nation = String(nationKey || '').trim();
    if (!messageText || !nation) {
        return { errorCode: 'GAME_NATION_SYSTEM_EVENT_INVALID' };
    }

    const entry = sanitizeGameChatMessageEntry({
        id: store.nextMessageId++,
        channel: 'system',
        sender: 'Nation Council',
        text: messageText,
        sentAt: new Date().toISOString(),
        source: 'system',
        nationKey: nation
    });

    store.channels.system.push(entry);
    trimGameChatChannelToCap(store, 'system');
    return { entry };
}

/** Council board edit — elected leadership; local dev owner bypass for caleb_admin QA only. */
function canEditNationCouncilBoard(commander) {
    const username = normalizeHeadquartersUsername(commander?.username);
    const storageKey = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!username || !storageKey) return false;

    if (isLocalDevOwnerLeadershipBypass(username)) {
        return true;
    }

    const leadership = readNationLeadershipForNation(storageKey);
    if (!leadership) return false;

    return leadership.leaderUsername === username
        || leadership.viceLeaderUsername === username
        || leadership.councilUsernames.includes(username)
        || leadership.plannerUsernames.includes(username);
}

function normalizeHeadquartersUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function readNationLeadershipMap() {
    const stored = db.get('portal.nationLeadership').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function readNationLeadershipForNation(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) return null;

    const record = readNationLeadershipMap()[storageKey];
    if (!record || typeof record !== 'object') return null;

    const councilUsernames = Array.isArray(record.councilUsernames)
        ? record.councilUsernames.map(normalizeHeadquartersUsername).filter(Boolean)
        : [];
    const plannerUsernames = Array.isArray(record.plannerUsernames)
        ? record.plannerUsernames.map(normalizeHeadquartersUsername).filter(Boolean)
        : [];

    return {
        leaderUsername: normalizeHeadquartersUsername(record.leaderUsername),
        viceLeaderUsername: normalizeHeadquartersUsername(record.viceLeaderUsername),
        councilUsernames: [...new Set(councilUsernames)],
        plannerUsernames: [...new Set(plannerUsernames)]
    };
}

function resolveHeadquartersAdminAccess(username, storageKey) {
    if (!isHeadquartersOwnerBypass(username)) {
        return null;
    }

    const resolvedStorageKey = storageKey || getCouncilBoardStorageKey(`staging:${username}`);
    if (!resolvedStorageKey) {
        return null;
    }

    return {
        gameNation: resolvedStorageKey,
        council: true,
        leader: true,
        viceLeader: true
    };
}

function countNationRank14Commanders(nationStorageKey) {
    if (!nationStorageKey) return 0;

    let count = 0;
    (db.get('commanders').value() || []).forEach((commander) => {
        const commanderNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
        if (commanderNation !== nationStorageKey) return;
        const rank = Math.max(1, Math.floor(Number(commander?.rank) || 1));
        if (rank >= NATION_AUTHORITY_RANK) count += 1;
    });
    return count;
}

function buildNationAuthoritySlice(nationStorageKey) {
    const rank14Count = countNationRank14Commanders(nationStorageKey);
    return {
        established: rank14Count >= NATION_AUTHORITY_MIN_RANK14,
        rank14Count,
        requiredCount: NATION_AUTHORITY_MIN_RANK14,
        requiredRank: NATION_AUTHORITY_RANK
    };
}

function resolveHeadquartersAccessForCommander(commander) {
    const username = normalizeHeadquartersUsername(commander?.username);
    const gameNation = resolveCouncilBoardNationKey(commander);
    const storageKey = getCouncilBoardStorageKey(gameNation);
    const nationAuthority = buildNationAuthoritySlice(storageKey);

    if (!username) {
        return {
            gameNation: storageKey || '',
            council: false,
            leader: false,
            viceLeader: false,
            fullAuthority: false,
            memberHub: false,
            nationAuthority
        };
    }

    const adminAccess = resolveHeadquartersAdminAccess(username, storageKey);
    if (adminAccess) {
        return {
            ...adminAccess,
            fullAuthority: true,
            memberHub: true,
            nationAuthority: {
                established: true,
                rank14Count: NATION_AUTHORITY_MIN_RANK14,
                requiredCount: NATION_AUTHORITY_MIN_RANK14,
                requiredRank: NATION_AUTHORITY_RANK
            }
        };
    }

    if (!storageKey) {
        return {
            gameNation: '',
            council: false,
            leader: false,
            viceLeader: false,
            fullAuthority: false,
            memberHub: false,
            nationAuthority
        };
    }

    const leadership = readNationLeadershipForNation(storageKey);
    const fullAuthority = nationAuthority.established;
    const isLeader = leadership?.leaderUsername === username;
    const isViceLeader = leadership?.viceLeaderUsername === username;
    const isCouncilMember = leadership?.councilUsernames?.includes(username);
    const isPlanner = leadership?.plannerUsernames?.includes(username);
    const commanderNationKey = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    const nationRoster = listNationVoteCandidates(
        db.get('commanders').value() || [],
        storageKey,
        (entry) => getCouncilBoardStorageKey(resolveCouncilBoardNationKey(entry))
    );
    const inNation = nationRoster.some((row) => row.id === username)
        || (Boolean(storageKey) && commanderNationKey === storageKey);

    return {
        gameNation: storageKey,
        council: fullAuthority && (isLeader || isViceLeader || isCouncilMember || isPlanner),
        leader: fullAuthority && isLeader,
        viceLeader: fullAuthority && isViceLeader,
        fullAuthority,
        memberHub: inNation,
        nationAuthority
    };
}

function readNationHeadquartersMap() {
    const stored = db.get('portal.nationHeadquarters').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function writeNationHeadquartersMap(map) {
    db.set('portal.nationHeadquarters', map && typeof map === 'object' ? map : {}).write();
}

function readNationHeadquartersForNation(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) return getDefaultNationHeadquartersState();

    const record = readNationHeadquartersMap()[storageKey];
    return normalizeNationHeadquartersState(record);
}

function writeNationHeadquartersForNation(nationKey, nextState) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const boards = readNationHeadquartersMap();
    boards[storageKey] = normalizeNationHeadquartersState({
        ...nextState,
        updatedAt: new Date().toISOString()
    });
    if (!boards[storageKey].publishedPlanning) {
        delete boards[storageKey].publishedPlanning;
    }
    writeNationHeadquartersMap(boards);
    return { state: boards[storageKey] };
}

function readHqBountyProgram() {
    const stored = db.get('portal.hqBountyProgram').value();
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function writeHqBountyProgram(program) {
    db.set('portal.hqBountyProgram', program && typeof program === 'object' ? program : {}).write();
}

function buildHeadquartersIntelSlices(commander, nationState) {
    const access = resolveHeadquartersAccessForCommander(commander);
    const gameNation = access.gameNation;
    if (!gameNation) {
        return {
            threatMatrix: [],
            spyLogs: [],
            hqBounties: buildHqBountyWorkspaceSlice({}, '')
        };
    }

    const commanders = db.get('commanders').value() || [];
    const movementStore = readAgeMovementStore();
    const warLedger = syncWarLedgerRelations(nationState?.warLedger, nationState?.diplomacy);
    const nationRecordsMap = readNationAgeRecordsMap();
    const ledgerRelations = warLedger?.relations || {};
    const allyNationIds = [
        ...(Array.isArray(ledgerRelations.allies) ? ledgerRelations.allies : []),
        ...(Array.isArray(ledgerRelations.naps) ? ledgerRelations.naps : [])
    ].map((row) => resolveCatalogNationKey(row?.nationId || row?.id)).filter(Boolean);

    const bountyProgram = resolveHqBountyCycle(
        readHqBountyProgram(),
        commanders,
        movementStore.cityHolders,
        resolveCatalogNationDisplayName
    );
    writeHqBountyProgram(bountyProgram);

    return {
        threatMatrix: buildThreatAssessmentMatrix({
            viewerNation: gameNation,
            cityHolders: movementStore.cityHolders,
            cityLosers: movementStore.cityLosers,
            cityCaptureAt: movementStore.cityCaptureAt,
            warLedger,
            commanders,
            nationRecordsMap,
            resolveCatalogNationDisplayName
        }),
        spyLogs: buildSpyLogsWorkspaceSlice(nationState?.spyLogs, {
            commanders,
            allyNationIds
        }),
        hqBounties: buildHqBountyWorkspaceSlice(bountyProgram, gameNation, commanders)
    };
}

const NATION_LEADER_MEMBERSHIP_TITLE = 'Leader';
const NATION_VICE_LEADER_MEMBERSHIP_TITLE = 'Vice Leader';

function syncNationLeadershipMembershipTitles(previousLeadership, nextLeadership) {
    const prevLeader = normalizeHeadquartersUsername(previousLeadership?.leaderUsername);
    const prevVice = normalizeHeadquartersUsername(previousLeadership?.viceLeaderUsername);
    const nextLeader = normalizeHeadquartersUsername(nextLeadership?.leaderUsername);
    const nextVice = normalizeHeadquartersUsername(nextLeadership?.viceLeaderUsername);

    const titleByUsername = new Map();
    [prevLeader, prevVice].forEach((username) => {
        if (!username || username === nextLeader || username === nextVice) return;
        titleByUsername.set(username, 'Basic');
    });
    if (nextLeader) titleByUsername.set(nextLeader, NATION_LEADER_MEMBERSHIP_TITLE);
    if (nextVice) titleByUsername.set(nextVice, NATION_VICE_LEADER_MEMBERSHIP_TITLE);

    titleByUsername.forEach((nextTitle, username) => {
        const commander = db.get('commanders').find({ username }).value();
        if (!commander) return;

        const currentTitle = String(commander.membershipTitle || '').trim();
        if (nextTitle === 'Basic') {
            const leadershipTitles = new Set([
                NATION_LEADER_MEMBERSHIP_TITLE,
                NATION_VICE_LEADER_MEMBERSHIP_TITLE
            ]);
            if (!leadershipTitles.has(currentTitle)) return;
        }

        db.get('commanders')
            .find({ username })
            .assign({ membershipTitle: nextTitle })
            .write();
    });
}

function writeNationLeadershipForNation(nationKey, leadership) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }

    const map = readNationLeadershipMap();
    const existing = map[storageKey] && typeof map[storageKey] === 'object' ? map[storageKey] : {};
    const previousLeadership = { ...existing };
    map[storageKey] = {
        ...existing,
        leaderUsername: normalizeHeadquartersUsername(leadership?.leaderUsername),
        viceLeaderUsername: normalizeHeadquartersUsername(leadership?.viceLeaderUsername),
        councilUsernames: Array.isArray(leadership?.councilUsernames)
            ? leadership.councilUsernames.map(normalizeHeadquartersUsername).filter(Boolean)
            : (Array.isArray(existing.councilUsernames) ? existing.councilUsernames : []),
        plannerUsernames: Array.isArray(leadership?.plannerUsernames)
            ? leadership.plannerUsernames.map(normalizeHeadquartersUsername).filter(Boolean)
            : (Array.isArray(existing.plannerUsernames) ? existing.plannerUsernames : []),
        updatedAt: new Date().toISOString()
    };
    db.set('portal.nationLeadership', map).write();
    syncNationLeadershipMembershipTitles(previousLeadership, map[storageKey]);
    return { leadership: readNationLeadershipForNation(storageKey) };
}

function resolveHeadquartersNationElectionState(nationKey) {
    const storageKey = getCouncilBoardStorageKey(nationKey);
    if (!storageKey) {
        return {
            nationState: getDefaultNationHeadquartersState(),
            leadership: null,
            isOpen: false,
            changed: false
        };
    }

    const nationState = readNationHeadquartersForNation(storageKey);
    const leadership = readNationLeadershipForNation(storageKey);
    const voteCandidates = listNationVoteCandidates(
        db.get('commanders').value() || [],
        storageKey,
        (entry) => getCouncilBoardStorageKey(resolveCouncilBoardNationKey(entry))
    );
    const reconciled = reconcileHeadquartersElection(nationState, leadership, voteCandidates);

    if (reconciled.changed) {
        writeNationHeadquartersForNation(storageKey, reconciled.nationState);
    }
    if (reconciled.shouldPersistLeadership && reconciled.leadership) {
        writeNationLeadershipForNation(storageKey, reconciled.leadership);
    }

    return {
        nationState: reconciled.nationState,
        leadership: reconciled.leadership,
        isOpen: reconciled.isOpen,
        changed: reconciled.changed
    };
}

function buildHeadquartersWorkspaceForCommander(commander) {
    const resolvedAccess = resolveHeadquartersAccessForCommander(commander);
    const gameNation = String(resolvedAccess.gameNation || '').trim()
        || getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    const access = {
        ...resolvedAccess,
        gameNation,
        memberHub: resolvedAccess.memberHub !== false
    };
    const electionState = resolveHeadquartersNationElectionState(gameNation);
    const voteCandidates = listNationVoteCandidates(
        db.get('commanders').value() || [],
        gameNation,
        (entry) => getCouncilBoardStorageKey(resolveCouncilBoardNationKey(entry))
    );
    const warTargets = listWarTargetNations(gameNation);

    const workspace = buildHeadquartersWorkspacePayload({
        access,
        nationState: electionState.nationState,
        voteCandidates,
        warTargets,
        username: commander?.username || '',
        leadership: electionState.leadership,
        votingOpen: electionState.isOpen
    });
    const intel = buildHeadquartersIntelSlices(commander, electionState.nationState);

    return {
        ...workspace,
        ...intel
    };
}

function resolveNationLeadershipDisplayName(username) {
    const normalized = normalizeHeadquartersUsername(username);
    if (!normalized) return '';

    const commander = findCommanderByUsername(normalized);
    return String(commander?.username || normalized).trim();
}

function buildNationLeadershipPayloadForCommander(commander) {
    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    const leadership = gameNation ? readNationLeadershipForNation(gameNation) : null;

    const leaderUsername = leadership?.leaderUsername || '';
    const viceLeaderUsername = leadership?.viceLeaderUsername || '';

    return {
        gameNation,
        leader: leaderUsername
            ? {
                username: leaderUsername,
                name: resolveNationLeadershipDisplayName(leaderUsername)
            }
            : null,
        viceLeader: viceLeaderUsername
            ? {
                username: viceLeaderUsername,
                name: resolveNationLeadershipDisplayName(viceLeaderUsername)
            }
            : null
    };
}

function ensureGameChatSeedMessages(store) {
    if (store.channels.system.length) return store;
    appendGameChatSystemEventToStore(
        store,
        'Khaeran has captured Thornwall from Aethelgard.'
    );
    return store;
}

function appendGameChatMessageToStore(store, payload, commander) {
    const channel = isGameChatChannelId(payload.channel) ? payload.channel : 'global';
    if (channel === 'system') {
        return { errorCode: 'GAME_SYSTEM_READ_ONLY' };
    }

    const sender = String(payload.sender || commander?.username || '').trim().slice(0, 80);
    const text = String(payload.text || '').trim().slice(0, GAME_CHAT_TEXT_MAX);
    if (!sender || !text) {
        return { errorCode: 'CHAT_SENDER_TEXT_REQUIRED' };
    }

    const poster = String(payload.posterUsername || payload.username || commander?.username || '').trim().toLowerCase();
    if (poster && poster !== sender.toLowerCase()) {
        return { errorCode: 'CHAT_SENDER_MISMATCH' };
    }

    const gameNation = String(commander?.gameNation || '').trim();
    const allianceId = String(commander?.allianceId || '').trim();

    if (channel === 'country' && !gameNation) {
        return { errorCode: 'GAME_NATION_REQUIRED' };
    }
    if (channel === 'alliance' && !allianceId) {
        return { errorCode: 'GAME_ALLIANCE_REQUIRED' };
    }

    const entry = sanitizeGameChatMessageEntry({
        id: store.nextMessageId++,
        channel,
        sender,
        text,
        sentAt: new Date().toISOString(),
        source: 'game',
        nationKey: channel === 'country' ? gameNation : null,
        allianceId: channel === 'alliance' ? allianceId : null,
        ...buildChatSenderRankMeta(commander)
    });

    store.channels[channel].push(entry);
    trimGameChatChannelToCap(store, channel);
    return { entry, channelMessages: store.channels[channel] };
}

function getGameChatUiFromCommander(commander) {
    const prefs = normalizeCommanderPreferences(commander?.preferences);
    return {
        opacity: prefs.gameChatOpacity,
        width: prefs.gameChatPanelWidth,
        height: prefs.gameChatPanelHeight,
        activeTab: prefs.gameChatActiveTab
    };
}

function filterGameChatMessagesForViewer(store, commander) {
    const gameNation = String(commander?.gameNation || '').trim();
    const allianceId = String(commander?.allianceId || '').trim();
    const nationKey = gameNation.toLowerCase();
    const allianceKey = allianceId.toLowerCase();

    const visible = {};
    GAME_CHAT_CHANNEL_IDS.forEach((channelId) => {
        visible[channelId] = (store.channels[channelId] || []).filter((entry) => {
            if (channelId === 'country') {
                return nationKey && String(entry.nationKey || '').trim().toLowerCase() === nationKey;
            }
            if (channelId === 'alliance') {
                return allianceKey && String(entry.allianceId || '').trim().toLowerCase() === allianceKey;
            }
            if (channelId === 'system') {
                const entryNation = String(entry.nationKey || '').trim().toLowerCase();
                if (!entryNation) return true;
                return nationKey && entryNation === nationKey;
            }
            return true;
        });
    });

    return {
        messagesByChannel: visible,
        hasAlliance: !!allianceId,
        gameNation,
        allianceId
    };
}

function sliceGameChatRowsAfterSince(rows, sinceIso) {
    const sinceMs = Date.parse(sinceIso || '');
    if (!Number.isFinite(sinceMs)) {
        return Array.isArray(rows) ? rows : [];
    }

    return (Array.isArray(rows) ? rows : []).filter((entry) => {
        const sentMs = Date.parse(entry.sentAt || '');
        return Number.isFinite(sentMs) && sentMs > sinceMs;
    });
}

function buildGameChatSyncPayload(filtered, communityMessages, sinceIso) {
    if (!sinceIso) {
        return {
            ...filtered,
            communityMessages,
            syncMode: 'full'
        };
    }

    const messagesByChannel = {};
    GAME_CHAT_CHANNEL_IDS.forEach((channelId) => {
        messagesByChannel[channelId] = sliceGameChatRowsAfterSince(
            filtered.messagesByChannel[channelId] || [],
            sinceIso
        );
    });

    return {
        ...filtered,
        messagesByChannel,
        communityMessages: sliceGameChatRowsAfterSince(communityMessages, sinceIso),
        syncMode: 'incremental'
    };
}

function patchGameChatUiPreferences(commander, body = {}) {
    const current = normalizeCommanderPreferences(commander.preferences);
    const next = { ...current };

    if (body.opacity !== undefined) {
        next.gameChatOpacity = clampNumber(body.opacity, 15, 100, current.gameChatOpacity);
    }
    if (body.width !== undefined) {
        next.gameChatPanelWidth = clampNumber(body.width, 280, 960, current.gameChatPanelWidth);
    }
    if (body.height !== undefined) {
        next.gameChatPanelHeight = clampNumber(body.height, 200, 840, current.gameChatPanelHeight);
    }
    if (body.activeTab !== undefined) {
        const tab = String(body.activeTab || '').trim();
        if (GAME_CHAT_UI_TABS.has(tab)) {
            next.gameChatActiveTab = tab;
        }
    }

    return next;
}

/* --- Section: Commander mailbox (ledger-backed player mail) --- */
const MAILBOX_TOPIC_MAX = 60;
const COMMANDER_PROFILE_BIO_MAX = 250;
const MAILBOX_BODY_MAX = 4000;
const MAILBOX_RECIPIENTS_MAX = 25;
const ROYAL_ARMIES_DISCORD_INVITE_URL = 'https://discord.gg/7tGBCt7cXX';
const WELCOME_SYSTEM_MESSAGE_KEY = 'welcome_to_royal_armies_v1';
const WELCOME_SYSTEM_MESSAGE_FROM = 'Ledger System';
const WELCOME_SYSTEM_MESSAGE_TOPIC = 'Welcome to the Royal Armies!';

function formatMailboxDisplayDate(isoValue) {
    const parsed = Date.parse(isoValue || '');
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toISOString().slice(0, 16).replace('T', ' ');
}

function createMailboxRecordId(seed = Date.now()) {
    return Number(seed);
}

function resolveLedgerCommanderUsername(username) {
    const needle = normalizeLedgerUsername(username);
    if (!needle || isHiddenRegistrationUsername(needle)) return null;

    const commanders = db.get('commanders').value() || [];
    const hit = commanders.find(
        (entry) => String(entry?.username || '').trim().toLowerCase() === needle.toLowerCase()
    );
    return hit ? String(hit.username).trim() : null;
}

function getMailboxMessageStore() {
    const rows = db.get('mailbox.messages').value();
    return Array.isArray(rows) ? rows : [];
}

function getMailboxDraftStore() {
    const rows = db.get('mailbox.drafts').value();
    return Array.isArray(rows) ? rows : [];
}

function writeMailboxMessageStore(rows) {
    db.set('mailbox.messages', rows).write();
}

function writeMailboxDraftStore(rows) {
    db.set('mailbox.drafts', rows).write();
}

const PLAYER_REPORT_ADMIN_RECIPIENT = 'caleb_admin';
const PLAYER_REPORT_MAIL_FROM = 'Moderation Desk';

function getPlayerReportStore() {
    const rows = db.get('portal.playerReports').value();
    return Array.isArray(rows) ? rows : [];
}

function writePlayerReportStore(rows) {
    db.set('portal.playerReports', Array.isArray(rows) ? rows : []).write();
}

function deliverPlayerReportAdminNotice(report) {
    if (!report || !isMailboxRecipientRosterAdmin(PLAYER_REPORT_ADMIN_RECIPIENT)) return;

    const categoryLabel = String(report.category || 'other').replace(/_/g, ' ');
    const topic = `[Report] ${report.targetUsername} — ${categoryLabel}`.slice(0, MAILBOX_TOPIC_MAX);
    const body = buildPlayerReportAdminMailBody(report).slice(0, MAILBOX_BODY_MAX);
    const messages = getMailboxMessageStore();
    const sentAt = new Date().toISOString();

    messages.push({
        id: createMailboxRecordId(),
        channel: 'inbox',
        from: PLAYER_REPORT_MAIL_FROM,
        to: PLAYER_REPORT_ADMIN_RECIPIENT,
        topic,
        body,
        read: false,
        sentAt
    });
    writeMailboxMessageStore(messages);
}

function serializePlayerReportForClient(report) {
    if (!report) return null;
    return {
        id: report.id,
        targetUsername: report.targetUsername,
        category: report.category,
        source: report.source,
        status: report.status || 'open',
        createdAt: report.createdAt,
        hasScreenshot: Boolean(report.screenshot?.filename)
    };
}

function serializeMailboxMessageForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        from: row.from || '',
        to: row.to || '',
        topic: row.topic || 'No subject',
        body: row.body || '',
        bodyFormat: row.bodyFormat === 'html' ? 'html' : 'text',
        read: !!row.read,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function buildWelcomeSystemMessageBodyHtml() {
    return [
        'We are so excited to have you on board! Royal Armies is planned to be the greatest evolutionary version of the PBBG franchise ever made and you will be able to see its development first hand. We hope you enjoy what this game has to offer and can tell all of your friends about it!',
        '',
        `If you would like to be a part of the growing community we have built outside of the game you can always join our official discord <a href="${ROYAL_ARMIES_DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer" style="color:#ffd700;text-decoration:underline;">here</a>.`
    ].join('\n\n');
}

function commanderHasWelcomeSystemMessage(messages, ownerLower) {
    return messages.some((row) => row
        && row.channel === 'system'
        && String(row.to || '').toLowerCase() === ownerLower
        && row.systemMessageKey === WELCOME_SYSTEM_MESSAGE_KEY);
}

function ensureWelcomeSystemMessageForCommander(username, options = {}) {
    const owner = resolveLedgerCommanderUsername(username);
    if (!owner) {
        return { delivered: false, reason: 'unknown_commander' };
    }

    const ownerLower = owner.toLowerCase();
    const messages = options.messages || getMailboxMessageStore();

    if (commanderHasWelcomeSystemMessage(messages, ownerLower)) {
        return { delivered: false, reason: 'already_delivered' };
    }

    messages.push({
        id: createMailboxRecordId(),
        channel: 'system',
        systemMessageKey: WELCOME_SYSTEM_MESSAGE_KEY,
        from: WELCOME_SYSTEM_MESSAGE_FROM,
        to: owner,
        topic: WELCOME_SYSTEM_MESSAGE_TOPIC,
        body: buildWelcomeSystemMessageBodyHtml(),
        bodyFormat: 'html',
        read: false,
        sentAt: new Date().toISOString()
    });

    if (options.deferWrite !== true) {
        writeMailboxMessageStore(messages);
    }

    return { delivered: true, reason: 'delivered' };
}

function backfillWelcomeSystemMessagesForAllCommanders() {
    const commanders = db.get('commanders').value() || [];
    const messages = getMailboxMessageStore();
    let delivered = 0;

    commanders.forEach((entry) => {
        const username = String(entry?.username || '').trim();
        if (!username || isHiddenRegistrationUsername(username)) return;
        const result = ensureWelcomeSystemMessageForCommander(username, { messages, deferWrite: true });
        if (result.delivered) delivered += 1;
    });

    let relabeled = 0;
    messages.forEach((row) => {
        if (!row || row.channel !== 'system' || row.systemMessageKey !== WELCOME_SYSTEM_MESSAGE_KEY) return;
        if (String(row.from || '').trim() !== WELCOME_SYSTEM_MESSAGE_FROM) {
            row.from = WELCOME_SYSTEM_MESSAGE_FROM;
            relabeled += 1;
        }
    });

    if (delivered > 0 || relabeled > 0) {
        writeMailboxMessageStore(messages);
        if (delivered > 0) {
            console.log(`[NEXUS] Delivered welcome system message to ${delivered} commander(s).`);
        }
        if (relabeled > 0) {
            console.log(`[NEXUS] Updated welcome system message sender label for ${relabeled} message(s).`);
        }
    }
}

function serializeMailboxSentForClient(row) {
    if (!row) return null;
    const recipients = Array.isArray(row.recipients) && row.recipients.length
        ? row.recipients
        : String(row.to || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    return {
        id: row.id,
        from: row.from || '',
        recipients,
        to: recipients.join(', '),
        topic: row.topic || 'No subject',
        body: row.body || '',
        read: true,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function outboundSentGroupKey(row) {
    return `${row.sentAt || ''}|${row.topic || ''}|${row.body || ''}`;
}

/** Creates sent-folder rows for outbound mail that predates sent-channel storage (e.g. live sends). */
function ensureSentCopiesForOutboundMail(owner) {
    const ownerLower = owner.toLowerCase();
    const messages = getMailboxMessageStore();
    const groups = new Map();

    messages.forEach((row) => {
        if (!row || row.channel !== 'inbox') return;
        if (String(row.from || '').trim().toLowerCase() !== ownerLower) return;
        const key = outboundSentGroupKey(row);
        if (!groups.has(key)) {
            groups.set(key, {
                from: row.from,
                topic: row.topic,
                body: row.body,
                sentAt: row.sentAt,
                recipients: []
            });
        }
        const bucket = groups.get(key);
        if (row.to && !bucket.recipients.includes(row.to)) {
            bucket.recipients.push(row.to);
        }
    });

    let changed = false;
    groups.forEach((group, key) => {
        const alreadyStored = messages.some(
            (row) => row.channel === 'sent'
                && String(row.from || '').trim().toLowerCase() === ownerLower
                && outboundSentGroupKey(row) === key
        );
        if (alreadyStored) return;

        messages.push({
            id: createMailboxRecordId(),
            channel: 'sent',
            from: group.from,
            recipients: group.recipients,
            to: group.recipients.join(', '),
            topic: group.topic,
            body: group.body,
            read: true,
            sentAt: group.sentAt || new Date().toISOString()
        });
        changed = true;
    });

    if (changed) writeMailboxMessageStore(messages);
}

function serializeMailboxDraftForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        recipients: Array.isArray(row.recipients) ? row.recipients : [],
        topic: row.topic || 'Untitled Draft',
        body: row.body || '',
        date: formatMailboxDisplayDate(row.updatedAt) || 'Draft'
    };
}

function getMailboxPayloadForUser(username) {
    const owner = resolveLedgerCommanderUsername(username);
    if (!owner) {
        return { status: 'error', code: 'NEXUS-GEN-005', message: 'Unknown commander account.' };
    }

    ensureWelcomeSystemMessageForCommander(owner);

    const ownerLower = owner.toLowerCase();
    const inbox = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'inbox' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const system = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'system' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const drafts = getMailboxDraftStore()
        .filter((row) => row && String(row.owner || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
        .map(serializeMailboxDraftForClient);

    ensureSentCopiesForOutboundMail(owner);

    const sent = getMailboxMessageStore()
        .filter(
            (row) => row && row.channel === 'sent' && String(row.from || '').toLowerCase() === ownerLower
        )
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxSentForClient);

    return { status: 'ok', username: owner, inbox, system, drafts, sent };
}

function pruneAgeSessionOnlineState() {
    const now = Date.now();
    for (const [username, session] of ageSessionByUser.entries()) {
        if (!session) continue;
        const joinedAt = Number(session.joinedAt) || now;
        const activeUntil = Number(session.activeUntil) || (joinedAt + AGE_SESSION_ACTIVE_MS);
        session.isOnline = now < activeUntil;
        ageSessionByUser.set(username, session);
    }
}

function touchPortalBrowseSession(username, options = {}) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = portalBrowseSessionByUser.get(normalized) || {};
    const activityAt = Number(options.lastActivityAt);
    const next = {
        lastSeen: now,
        chatLastSeen: options.onCommunityChat === true
            ? now
            : (existing.chatLastSeen || null),
        lastActivityAt: Number.isFinite(activityAt) && activityAt > 0
            ? Math.max(existing.lastActivityAt || 0, activityAt)
            : (existing.lastActivityAt || now)
    };

    portalBrowseSessionByUser.set(normalized, next);
    return normalized;
}

function resolvePortalBrowsePresenceState(session, now = Date.now()) {
    if (!session) return null;
    if ((now - session.lastSeen) > PORTAL_BROWSE_ONLINE_TTL_MS) return null;

    const lastActivity = session.lastActivityAt || session.lastSeen;
    if ((now - lastActivity) >= PORTAL_PRESENCE_IDLE_MS) return 'idle';

    const chatLastSeen = session.chatLastSeen || 0;
    if (chatLastSeen && (now - chatLastSeen) <= CHAT_PRESENCE_ACTIVE_MS) return 'chat';

    return 'portal';
}

function removePortalBrowseSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    portalBrowseSessionByUser.delete(normalized);
}

function prunePortalBrowseSessions() {
    const now = Date.now();
    for (const [username, session] of portalBrowseSessionByUser.entries()) {
        if (!session || (now - session.lastSeen) > PORTAL_BROWSE_ONLINE_TTL_MS) {
            portalBrowseSessionByUser.delete(username);
        }
    }
}

function getPortalBrowseMetrics() {
    prunePortalBrowseSessions();

    const now = Date.now();
    const portalBrowsingPlayers = [...portalBrowseSessionByUser.entries()]
        .map(([username, session]) => {
            const presence = resolvePortalBrowsePresenceState(session, now);
            if (!presence) return null;
            return { username, presence };
        })
        .filter(Boolean)
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    return {
        portalBrowsingCount: portalBrowsingPlayers.length,
        portalBrowsingPlayers
    };
}

function getPortalLiveMetricsPayload() {
    const commanders = db.get('commanders').value() || [];
    const visibleCommanders = commanders.filter(
        (entry) => entry && entry.username && !isHiddenRegistrationUsername(entry.username)
    );

    const recentRegistrations = [...visibleCommanders]
        .sort((a, b) => {
            const aTime = Date.parse(a.joinedAt || 0) || 0;
            const bTime = Date.parse(b.joinedAt || 0) || 0;
            return bTime - aTime;
        })
        .slice(0, 25)
        .map((entry) => ({
            username: entry.username,
            joinedAt: entry.joinedAt || null
        }));

    return {
        registeredCount: visibleCommanders.length,
        recentRegistrations,
        deploy: getDeployStatePayload(),
        commanderAccountResetAt: readPortalCommanderAccountResetAt(),
        ageCampaign: readPortalAgeCampaignPayload(),
        ...getAgeSessionMetrics(),
        ...getPortalBrowseMetrics()
    };
}

function getAgeSessionMetrics() {
    pruneAgeSessionOnlineState();

    const playingEntries = [...ageSessionByUser.entries()]
        .filter(([username]) => !isHiddenRegistrationUsername(username))
        .map(([username, session]) => ({
            username,
            joinedAt: session.joinedAt || null,
            isOnline: !!session.isOnline
        }));

    const agePlayingPlayers = playingEntries
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    const ageOnlinePlayers = playingEntries
        .filter((entry) => entry.isOnline)
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    return {
        ageOnlineCount: ageOnlinePlayers.length,
        agePlayingCount: agePlayingPlayers.length,
        ageOnlinePlayers,
        agePlayingPlayers
    };
}

function markAgeSessionOffline(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = ageSessionByUser.get(normalized);
    if (!existing) return null;

    ageSessionByUser.set(normalized, {
        ...existing,
        joinedAt: existing.joinedAt || now,
        lastSeen: now,
        activeUntil: now,
        isOnline: false
    });
    return ageSessionByUser.get(normalized);
}

function touchAgeSession(username, options = {}) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = ageSessionByUser.get(normalized);
    const joinedAt = existing?.joinedAt || now;
    const markOnline = options.markOnline !== false;
    const refreshActiveWindow = options.refreshActiveWindow === true;
    let activeUntil = Number(existing?.activeUntil) || 0;
    if (refreshActiveWindow || !activeUntil || activeUntil <= now) {
        activeUntil = now + AGE_SESSION_ACTIVE_MS;
    }

    const nextSession = {
        joinedAt,
        lastSeen: now,
        activeUntil,
        isOnline: markOnline && now < activeUntil
    };

    ageSessionByUser.set(normalized, nextSession);
    return nextSession;
}

function removeAgeSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    ageSessionByUser.delete(normalized);
}

function clearAllAgeSessions() {
    ageSessionByUser.clear();
}

function readPortalCommanderAccountResetAt() {
    const portal = db.get('portal').value() || {};
    const resetAt = portal.commanderAccountResetAt;
    return resetAt ? String(resetAt).trim() : null;
}

function readPortalAgeCampaignPayload() {
    const portal = db.get('portal').value() || {};
    return readAgeCampaignFromPortal(portal);
}

function clearAgeMovementCommanderPositions() {
    const movementStore = readAgeMovementStore();
    movementStore.commanders = {};
    writeAgeMovementStore(movementStore);
}

const tickAgeCampaignLifecycle = createAgeCampaignLifecycleRunner(db, {
    resetCommanderRecordPreservingAchievements,
    clearAgeMovementCommanders: clearAgeMovementCommanderPositions,
    clearAllAgeSessions,
    finalizeCountryChatForAgeEnd,
    onAgeConcluded({ ageNumber, resetCount, commanderAccountResetAt }) {
        console.log(
            `[NEXUS] Age ${ageNumber} concluded — reset ${resetCount} commander account(s) at ${commanderAccountResetAt}.`
        );
    },
    onNextAgeStarted({ ageNumber, startedAt, campaign }) {
        const meta = readPortalGameAgeMeta();
        const nextSlug = buildAgeSlugForCampaign(campaign || { era: 'beta', number: ageNumber });
        writePortalGameAgeMeta({
            ...meta,
            activeSlug: nextSlug,
            startedAt,
            endedAt: null
        });
        console.log(`[NEXUS] ${formatAgeCampaignDisplayLabel(campaign || { era: 'beta', number: ageNumber })} began at ${startedAt}.`);
    },
    prepareCountryChatForAgeStart() {
        const meta = readPortalGameAgeMeta();
        prepareCountryChatForAgeStart(meta.activeSlug);
    }
});

function commanderHasValidAgePortalEnrollment(commander) {
    const portalResetAt = readPortalCommanderAccountResetAt();
    if (!portalResetAt) return true;

    const enrolledAt = String(commander?.agePortalEnrolledAt || '').trim();
    if (!enrolledAt) return false;

    const resetMs = Date.parse(portalResetAt);
    const enrolledMs = Date.parse(enrolledAt);
    if (!Number.isFinite(resetMs)) return true;
    if (!Number.isFinite(enrolledMs)) return false;
    return enrolledMs >= resetMs;
}

function normalizeLedgerUsername(value) {
    return String(value || '').trim();
}

function normalizeLedgerEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function findCommanderByUsernameOrEmail(identifier) {
    const needle = String(identifier || '').trim();
    if (!needle) return null;

    const commanders = db.get('commanders').value() || [];
    const lowerNeedle = needle.toLowerCase();

    return commanders.find((entry) => {
        if (!entry) return false;
        const username = String(entry.username || '').trim().toLowerCase();
        const email = normalizeLedgerEmail(entry.email);
        return username === lowerNeedle || email === lowerNeedle;
    }) || null;
}

const LEGAL_TERMS_VERSION = '2026-06-01';

function getCommanderAcceptedTermsVersion(commander) {
    if (!commander) return '';
    return String(commander.termsVersion || commander.terms_version || '').trim();
}

function getCommanderTermsAcceptedAt(commander) {
    if (!commander) return null;
    const at = commander.terms_accepted_at || commander.termsAcceptedAt;
    return at ? String(at) : null;
}

function commanderHasAcceptedTerms(commander) {
    if (!getCommanderTermsAcceptedAt(commander)) return false;
    return getCommanderAcceptedTermsVersion(commander) === LEGAL_TERMS_VERSION;
}

function applyTermsAcceptanceToCommander(username, termsVersion) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return null;

    const acceptedAt = new Date().toISOString();
    const version = String(termsVersion || LEGAL_TERMS_VERSION).trim().slice(0, 32) || LEGAL_TERMS_VERSION;

    db.get('commanders')
        .find({ username: normalized })
        .assign({
            termsAccepted: true,
            termsAcceptedAt: acceptedAt,
            terms_accepted_at: acceptedAt,
            termsVersion: version
        })
        .write();

    return findCommanderByUsername(normalized);
}

function isLiveServerPort5500Request(req) {
    if (!req) return false;

    const previewHeader = String(
        req.get('x-royal-armies-live-preview')
        || req.headers['x-royal-armies-live-preview']
        || ''
    ).trim();
    if (previewHeader && previewHeader !== '3000') {
        return true;
    }

    const checkUrl = (value) => {
        const text = String(value || '').toLowerCase();
        return /:\/\/localhost:(?!3000)\d+/.test(text)
            || /:\/\/127\.0\.0\.1:(?!3000)\d+/.test(text)
            || /:\/\/\[::1\]:(?!3000)\d+/.test(text);
    };

    return checkUrl(req.get('origin')) || checkUrl(req.get('referer'));
}

function shouldAutoAcceptTermsForDevJoin(commander, req) {
    if (isLiveServerPort5500Request(req)) return true;
    return !isProduction && isLocalDevHostRequest(req);
}

function assertCommanderAcceptedTermsForJoinAge(commander, req) {
    if (shouldAutoAcceptTermsForDevJoin(commander, req)) {
        if (commander && !commanderHasAcceptedTerms(commander)) {
            applyTermsAcceptanceToCommander(commander.username, LEGAL_TERMS_VERSION);
        }
        return { ok: true };
    }

    if (!commanderHasAcceptedTerms(commander)) {
        return {
            ok: false,
            code: 'NEXUS-GAME-011',
            message: 'You must accept the terms before joining this round.'
        };
    }
    return { ok: true };
}

function findCommanderByUsername(username) {
    const normalized = normalizeLedgerUsername(username).toLowerCase();
    if (!normalized) return null;

    const commanders = db.get('commanders').value() || [];
    return commanders.find((entry) => {
        if (!entry) return false;
        return String(entry.username || '').trim().toLowerCase() === normalized;
    }) || null;
}

function isLocalDevHostRequest(req) {
    const host = String(req?.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function buildDefaultCommanderLedgerRecord(username) {
    const normalized = normalizeLedgerUsername(username);
    return {
        username: normalized,
        email: `${normalized.toLowerCase()}@dev.local`,
        password: '',
        token: '',
        verified: true,
        joinedAt: new Date().toISOString(),
        bio: '',
        privacy: 'Public',
        avatarUrl: '',
        country: '',
        timezone: '',
        gameNation: '',
        allianceId: '',
        ageHistory: [],
        awards: [],
        medals: [],
        membershipTitle: 'Basic',
        premiumMember: false,
        chronicleXp: getDefaultCommanderChronicleXp(),
        ageResetUsage: {},
        preferences: getDefaultCommanderPreferences()
    };
}

function ensureLocalDevCommanderInLedger(username, req) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const sessionUser = normalizeLedgerUsername(req?.session?.username || '');
    const isBootstrapUser = DEV_BOOTSTRAP_USERNAMES.has(normalized.toLowerCase());
    const sessionMatches = sessionUser && sessionUser.toLowerCase() === normalized.toLowerCase();
    if (!isBootstrapUser && !sessionMatches) return null;

    const existing = findCommanderByUsername(normalized);
    if (existing) return existing;

    const record = buildDefaultCommanderLedgerRecord(normalized);
    db.get('commanders').push(record).write();
    console.log(`[NEXUS] Local dev ledger entry created for ${normalized}.`);
    return findCommanderByUsername(normalized);
}

function resolvePortalAccountUsername(rawUsername, req) {
    const resolved = resolveLedgerCommanderUsername(rawUsername);
    if (resolved) return resolved;

    if (isProduction || !isLocalDevHostRequest(req)) return null;

    const commander = ensureLocalDevCommanderInLedger(rawUsername, req);
    return commander ? String(commander.username).trim() : null;
}

function normalizeCommanderProfilePrivacy(value) {
    return String(value || '').trim() === 'Private' ? 'Private' : 'Public';
}

function getDefaultCommanderChronicleXp() {
    return {
        version: 2,
        totalXp: 0,
        byActivity: {
            cityBattles: { actions: 0, xp: 0 },
            pvpAttacks: { actions: 0, xp: 0 },
            loreDiscoveries: { actions: 0, xp: 0 }
        },
        lastGain: null
    };
}

const COMMANDER_DISPLAY_RESOLUTION_PRESETS = new Set([
    'auto',
    '1280x720',
    '1366x768',
    '1600x900',
    '1920x1080',
    '2560x1440',
    '3840x2160'
]);

function getDefaultCommanderPreferences() {
    return {
        uiScale: 1,
        textScale: 1,
        displayResolution: 'auto',
        highContrast: false,
        masterVol: 1,
        musicVol: 0.5,
        narrationVol: 1,
        sfxVol: 0.2,
        verbosity: 'Detailed',
        pings: 'Enabled',
        safetyLock: 'Double-Click',
        dyslexiaFont: false,
        portalMasterVol: 1,
        portalMusicVol: 0.5,
        portalNarrationVol: 1,
        portalSfxVol: 0.2,
        gameChatOpacity: 85,
        gameChatPanelWidth: 380,
        gameChatPanelHeight: 320,
        gameChatActiveTab: 'global'
    };
}

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeCommanderPreferences(raw) {
    const defaults = getDefaultCommanderPreferences();
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        uiScale: clampNumber(source.uiScale, 0.5, 2, defaults.uiScale),
        textScale: clampNumber(source.textScale, 0.75, 1.5, defaults.textScale),
        displayResolution: COMMANDER_DISPLAY_RESOLUTION_PRESETS.has(String(source.displayResolution || '').trim())
            ? String(source.displayResolution).trim()
            : defaults.displayResolution,
        highContrast: !!source.highContrast,
        masterVol: clampNumber(source.masterVol, 0, 1, defaults.masterVol),
        musicVol: clampNumber(source.musicVol, 0, 1, defaults.musicVol),
        narrationVol: clampNumber(source.narrationVol, 0, 1, defaults.narrationVol),
        sfxVol: clampNumber(source.sfxVol, 0, 1, defaults.sfxVol),
        verbosity: String(source.verbosity || defaults.verbosity),
        pings: String(source.pings || defaults.pings),
        safetyLock: String(source.safetyLock || defaults.safetyLock),
        dyslexiaFont: !!source.dyslexiaFont,
        portalMasterVol: clampNumber(source.portalMasterVol, 0, 1, defaults.portalMasterVol),
        portalMusicVol: clampNumber(source.portalMusicVol, 0, 1, defaults.portalMusicVol),
        portalNarrationVol: clampNumber(source.portalNarrationVol, 0, 1, defaults.portalNarrationVol),
        portalSfxVol: clampNumber(source.portalSfxVol, 0, 1, defaults.portalSfxVol),
        gameChatOpacity: clampNumber(source.gameChatOpacity, 15, 100, defaults.gameChatOpacity),
        gameChatPanelWidth: clampNumber(source.gameChatPanelWidth, 280, 960, defaults.gameChatPanelWidth),
        gameChatPanelHeight: clampNumber(source.gameChatPanelHeight, 200, 840, defaults.gameChatPanelHeight),
        gameChatActiveTab: GAME_CHAT_UI_TABS.has(String(source.gameChatActiveTab || '').trim())
            ? String(source.gameChatActiveTab).trim()
            : defaults.gameChatActiveTab,
        rankTitleGender: resolveCommanderRankTitleGender(source.rankTitleGender)
    };
}

function isBattlePassServerEnabled() {
    return BATTLE_PASS_SERVER_ENABLED === true;
}

function dossierPatchIncludesBattlePassFields(body) {
    return !!(body && typeof body === 'object' && 'chronicleXp' in body);
}

function normalizeCommanderChronicleXp(raw) {
    const defaults = getDefaultCommanderChronicleXp();
    if (!raw || typeof raw !== 'object') return defaults;
    const byActivity = { ...defaults.byActivity };
    if (raw.byActivity && typeof raw.byActivity === 'object') {
        for (const key of Object.keys(byActivity)) {
            const bucket = raw.byActivity[key];
            if (bucket && typeof bucket === 'object') {
                byActivity[key] = {
                    actions: Math.max(0, parseInt(bucket.actions, 10) || 0),
                    xp: Math.max(0, parseInt(bucket.xp, 10) || 0)
                };
            }
        }
    }
    return {
        version: 2,
        totalXp: Math.max(0, parseInt(raw.totalXp, 10) || 0),
        byActivity,
        lastGain: raw.lastGain && typeof raw.lastGain === 'object' ? raw.lastGain : null
    };
}

function normalizeCommanderDossierArray(raw, maxItems = 200) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, maxItems).filter((entry) => entry && typeof entry === 'object');
}

const ACHIEVEMENT_CATALOG_ORDER = ['first_timer', 'whoa_slow_down'];

const ACHIEVEMENT_CATALOG = Object.freeze({
    first_timer: Object.freeze({
        id: 'first_timer',
        label: 'First Timer',
        achievement: 'Logging in for the first time',
        iconUrl: 'images/first_timer.png',
        xpReward: 15
    }),
    whoa_slow_down: Object.freeze({
        id: 'whoa_slow_down',
        label: "Whoa, slow down! We're not finished yet.",
        achievement: 'Attempt to JOIN AGE before the game engine has been developed.',
        iconUrl: 'images/whoa_slow_down_icon.png',
        xpReward: 30
    })
});

function commanderAwardsIncludeId(awards, achievementId) {
    const id = String(achievementId || '').trim();
    if (!id) return false;
    return awards.some((entry) => String(entry?.id || entry?.achievementId || '').trim() === id);
}

function sortCommanderAwardsByCatalog(awards) {
    const orderIndex = (entry) => {
        const id = String(entry?.id || entry?.achievementId || '').trim();
        const idx = ACHIEVEMENT_CATALOG_ORDER.indexOf(id);
        return idx === -1 ? ACHIEVEMENT_CATALOG_ORDER.length + 1 : idx;
    };

    return awards.slice().sort((a, b) => {
        const orderDiff = orderIndex(a) - orderIndex(b);
        if (orderDiff !== 0) return orderDiff;
        const aTime = Date.parse(a?.earnedAt || '') || 0;
        const bTime = Date.parse(b?.earnedAt || '') || 0;
        return aTime - bTime;
    });
}

function buildCommanderAchievementRecord(definition, username) {
    const subject = String(username || '').trim();
    const copy = definition.achievement || definition.description || '';
    return {
        id: definition.id,
        label: definition.label,
        achievement: copy,
        description: copy,
        iconUrl: String(definition.iconUrl || '').trim(),
        xpReward: Number(definition.xpReward ?? definition.xp ?? 0) || 0,
        username: subject,
        earnedAt: new Date().toISOString()
    };
}

function enrichCommanderAwardsForClient(awards) {
    const list = normalizeCommanderDossierArray(awards, 100);
    return sortCommanderAwardsByCatalog(list.map((entry) => {
        const id = String(entry?.id || entry?.achievementId || '').trim();
        const definition = ACHIEVEMENT_CATALOG[id];
        const copy = entry?.achievement || entry?.description || definition?.achievement || '';

        if (!definition) {
            const iconUrl = String(entry?.iconUrl || entry?.icon || '').trim();
            return iconUrl ? { ...entry, iconUrl } : entry;
        }

        return {
            ...entry,
            id: definition.id,
            label: entry.label || definition.label,
            achievement: copy,
            description: copy,
            iconUrl: String(definition.iconUrl).trim(),
            xpReward: Number(entry.xpReward ?? entry.xp ?? definition.xpReward) || 0
        };
    }));
}

function insertCommanderAchievementInCatalogOrder(awards, record) {
    const next = awards.slice();
    const recordId = String(record?.id || '').trim();
    const recordOrder = ACHIEVEMENT_CATALOG_ORDER.indexOf(recordId);
    let insertAt = next.length;

    for (let i = 0; i < next.length; i += 1) {
        const existingId = String(next[i]?.id || next[i]?.achievementId || '').trim();
        const existingOrder = ACHIEVEMENT_CATALOG_ORDER.indexOf(existingId);
        if (existingOrder !== -1 && recordOrder !== -1 && existingOrder > recordOrder) {
            insertAt = i;
            break;
        }
    }

    next.splice(insertAt, 0, record);
    return sortCommanderAwardsByCatalog(next);
}

function ensureFirstTimerAchievementForCommander(commander, options = {}) {
    if (!commander || !commander.username) {
        return { added: false, record: null, reason: 'unknown_commander' };
    }

    const definition = ACHIEVEMENT_CATALOG.first_timer;
    const awards = normalizeCommanderDossierArray(commander.awards, 100);
    if (commanderAwardsIncludeId(awards, definition.id)) {
        const enriched = enrichCommanderAwardsForClient(awards);
        const repaired = JSON.stringify(enriched) !== JSON.stringify(awards);
        commander.awards = enriched;
        if (repaired && options.deferWrite !== true) {
            db.get('commanders')
                .find({ username: commander.username })
                .assign({ awards: commander.awards })
                .write();
        }
        return { added: false, record: null, reason: repaired ? 'repaired_metadata' : 'already_owned' };
    }

    const record = buildCommanderAchievementRecord(definition, commander.username);
    commander.awards = insertCommanderAchievementInCatalogOrder(awards, record);

    if (options.deferWrite !== true) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({ awards: commander.awards })
            .write();
    }

    return { added: true, record, reason: 'granted' };
}

function backfillFirstTimerAchievementForAllCommanders() {
    const commanders = db.get('commanders').value() || [];
    let added = 0;
    let repaired = 0;

    commanders.forEach((commander) => {
        const username = String(commander?.username || '').trim();
        if (!username || isHiddenRegistrationUsername(username)) return;

        const before = JSON.stringify(commander.awards || []);
        commander.awards = enrichCommanderAwardsForClient(commander.awards);
        if (JSON.stringify(commander.awards) !== before) repaired += 1;

        const result = ensureFirstTimerAchievementForCommander(commander, { deferWrite: true });
        if (result.added) added += 1;
    });

    if (added > 0 || repaired > 0) {
        db.set('commanders', commanders).write();
        if (added > 0) {
            console.log(`[NEXUS] Granted First Timer achievement to ${added} commander(s).`);
        }
        if (repaired > 0) {
            console.log(`[NEXUS] Repaired achievement icon metadata for ${repaired} commander(s).`);
        }
    }
}

function normalizeCommanderAgeResetUsage(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const next = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object') continue;
        next[String(key).slice(0, 64)] = {
            sessionKey: String(value.sessionKey || '').slice(0, 128),
            rankResetsUsed: Math.max(0, Math.min(10, parseInt(value.rankResetsUsed, 10) || 0)),
            exileResetsUsed: Math.max(0, Math.min(10, parseInt(value.exileResetsUsed, 10) || 0))
        };
    }
    return next;
}

function serializeCommanderProfileForClient(commander) {
    if (!commander) return null;
    const dossier = serializeCommanderDossierForClient(commander);
    return {
        status: 'ok',
        username: dossier.username,
        bio: dossier.bio,
        privacy: dossier.privacy,
        profileUpdatedAt: dossier.profileUpdatedAt
    };
}

function serializeCommanderDossierForClient(commander) {
    if (!commander) return null;
    const legacyBio = commander.description != null ? String(commander.description) : '';
    const bioSource = commander.bio != null ? String(commander.bio) : legacyBio;
    const resolvedMembershipTitle = resolveCommanderMembershipTitleForLedger(commander);
    const resolvedPremiumMember = resolvedMembershipTitle === 'Royalty' || !!commander.premiumMember;
    const dossier = {
        status: 'ok',
        username: commander.username,
        bio: bioSource.trim().slice(0, COMMANDER_PROFILE_BIO_MAX),
        privacy: normalizeCommanderProfilePrivacy(commander.privacy),
        avatarUrl: String(commander.avatarUrl || '').slice(0, 512),
        country: String(commander.country || '').trim().slice(0, 120),
        timezone: String(commander.timezone || '').trim().slice(0, 120),
        gameNation: String(commander.gameNation || '').trim().slice(0, 80),
        allianceId: String(commander.allianceId || '').trim().slice(0, 80),
        ageHistory: normalizeCommanderDossierArray(commander.ageHistory, 50),
        awards: enrichCommanderAwardsForClient(commander.awards),
        medals: normalizeCommanderDossierArray(commander.medals, 100),
        membershipTitle: resolvedMembershipTitle,
        premiumMember: resolvedPremiumMember,
        battlePassServerEnabled: isBattlePassServerEnabled(),
        ageResetUsage: normalizeCommanderAgeResetUsage(commander.ageResetUsage),
        preferences: normalizeCommanderPreferences(commander.preferences),
        profileUpdatedAt: commander.profileUpdatedAt || null,
        dossierUpdatedAt: commander.dossierUpdatedAt || null
    };
    if (isBattlePassServerEnabled()) {
        dossier.chronicleXp = normalizeCommanderChronicleXp(commander.chronicleXp);
    }
    return dossier;
}

function resolveCommanderMembershipTitleForLedger(commander) {
    const username = String(commander?.username || '').trim().toLowerCase();
    if (isHeadquartersOwnerBypass(username)) return 'Royalty';
    if (commander?.premiumMember) return 'Royalty';
    const stored = String(commander?.membershipTitle || 'Basic').trim();
    if (stored === 'Royalty' || stored === 'Royalty Member') return 'Royalty';
    return stored.slice(0, 64) || 'Basic';
}

function grantRoyaltyMembershipToCommander(username) {
    const resolved = resolveLedgerCommanderUsername(username);
    if (!resolved) return null;

    const commander = db.get('commanders').find({ username: resolved }).value();
    if (!commander) return null;

    db.get('commanders')
        .find({ username: resolved })
        .assign({
            membershipTitle: 'Royalty',
            premiumMember: true,
            dossierUpdatedAt: new Date().toISOString()
        })
        .write();

    return db.get('commanders').find({ username: resolved }).value();
}

function buildCommanderDossierPatch(body) {
    const patch = {};
    if (!body || typeof body !== 'object') return patch;

    if ('bio' in body) {
        patch.bio = String(body.bio ?? '').trim().slice(0, COMMANDER_PROFILE_BIO_MAX);
    }
    if ('privacy' in body) {
        patch.privacy = normalizeCommanderProfilePrivacy(body.privacy);
    }
    if ('avatarUrl' in body) {
        patch.avatarUrl = String(body.avatarUrl ?? '').trim().slice(0, 512);
    }
    if ('country' in body) {
        patch.country = String(body.country ?? '').trim().slice(0, 120);
    }
    if ('timezone' in body) {
        patch.timezone = String(body.timezone ?? '').trim().slice(0, 120);
    }
    if ('ageHistory' in body) {
        patch.ageHistory = normalizeCommanderDossierArray(body.ageHistory, 50);
    }
    if ('awards' in body) {
        patch.awards = enrichCommanderAwardsForClient(body.awards);
    }
    if ('medals' in body) {
        patch.medals = normalizeCommanderDossierArray(body.medals, 100);
    }
    if ('membershipTitle' in body) {
        const nextTitle = String(body.membershipTitle ?? 'Basic').slice(0, 64);
        patch.membershipTitle = nextTitle;
        if (nextTitle === 'Royalty' || nextTitle === 'Royalty Member') {
            patch.premiumMember = true;
        } else if (nextTitle === 'Basic' || nextTitle === 'Basic Member' || nextTitle === 'Bronze') {
            patch.premiumMember = false;
        }
    }
    if ('premiumMember' in body) {
        patch.premiumMember = !!body.premiumMember;
        if (patch.premiumMember) {
            patch.membershipTitle = 'Royalty';
        }
    }
    if ('chronicleXp' in body && isBattlePassServerEnabled()) {
        patch.chronicleXp = normalizeCommanderChronicleXp(body.chronicleXp);
    }
    if ('ageResetUsage' in body) {
        patch.ageResetUsage = normalizeCommanderAgeResetUsage(body.ageResetUsage);
    }
    if ('preferences' in body) {
        patch.preferences = normalizeCommanderPreferences(body.preferences);
    }

    if (Object.keys(patch).length) {
        patch.dossierUpdatedAt = new Date().toISOString();
    }
    if ('bio' in patch || 'privacy' in patch || 'avatarUrl' in patch || 'country' in patch || 'timezone' in patch) {
        patch.profileUpdatedAt = patch.dossierUpdatedAt || new Date().toISOString();
    }

    return patch;
}

function getPublicSiteOrigin(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    if (forwardedProto && forwardedHost) {
        const proto = String(forwardedProto).split(',')[0].trim();
        const host = String(forwardedHost).split(',')[0].trim();
        return `${proto}://${host}`;
    }
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    return host ? `${protocol}://${host}` : 'https://royalarmies.com';
}

/* ==========================================
   NEXUS MODULE: SERVER CONFIGURATION
   ========================================== */

/* --- Section: Application Assembly --- */

/* Block 4: Framework & Service Imports */
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const compression = require('compression');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/* Block 5: Runtime Constants & Express Instance */
const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend('re_eMzwshB5_EmorLivvuzwbHk6jpAzWtpWE');

if (isProduction) {
    app.set('trust proxy', 1);
}

/* ==========================================
   NEXUS MODULE: SECURITY & MIDDLEWARE
   ========================================== */

/* --- Section: Middleware Token Handlers --- */

/* Block 6: Compression & Body Parsers */
app.use(compression());
app.use((req, res, next) => {
    const isPlayerReportPost = req.method === 'POST' && req.path === '/api/portal/player-reports';
    return express.json({ limit: isPlayerReportPost ? '3mb' : '100kb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

const PORTAL_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PORTAL_INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;

app.use(session({
    name: 'royalArmiesPortalSid',
    secret: process.env.SESSION_SECRET || 'royal-armies-nexus-dev-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: PORTAL_SESSION_MAX_AGE_MS
    }
}));

app.use(rejectStaleDeployPortalSession);

function getPortalSessionLastActivityAt(req) {
    const session = req.session;
    if (!session) return 0;

    const lastActivity = Number(session.lastActivityAt);
    if (Number.isFinite(lastActivity) && lastActivity > 0) return lastActivity;

    const loginAt = Number(session.loginAt);
    if (Number.isFinite(loginAt) && loginAt > 0) return loginAt;

    return 0;
}

function isPortalSessionInactive(req, nowMs = Date.now()) {
    const username = String(req.session?.username || '').trim();
    if (!username) return false;

    const lastActivity = getPortalSessionLastActivityAt(req);
    if (!lastActivity) return false;

    return (nowMs - lastActivity) >= PORTAL_INACTIVITY_TIMEOUT_MS;
}

function touchPortalSessionActivity(req, activityAtMs) {
    if (!req.session?.username) return;

    const candidate = Number.isFinite(Number(activityAtMs)) && Number(activityAtMs) > 0
        ? Number(activityAtMs)
        : Date.now();
    const previous = getPortalSessionLastActivityAt(req);
    req.session.lastActivityAt = Math.max(previous || 0, candidate);
}

function destroyPortalSessionForInactivity(req, res, callback) {
    const finish = typeof callback === 'function' ? callback : () => {};
    if (typeof req.session?.destroy === 'function') {
        return req.session.destroy((err) => {
            if (err) {
                console.warn('[NEXUS] Session destroy failed:', err);
            }
            if (res && typeof res.clearCookie === 'function') {
                res.clearCookie('royalArmiesPortalSid');
            }
            finish();
        });
    }
    if (res && typeof res.clearCookie === 'function') {
        res.clearCookie('royalArmiesPortalSid');
    }
    finish();
}

function rejectInactivePortalSession(req, res) {
    if (!isPortalSessionInactive(req)) return false;

    destroyPortalSessionForInactivity(req, res, () => {
        sendApiError(res, 'NEXUS-AUTH-017');
    });
    return true;
}

function setPortalSessionForUser(req, username, rememberMe = true) {
    req.session.username = String(username || '').trim();
    if (!req.session.username) return;

    const nowMs = Date.now();
    req.session.loginAt = nowMs;
    req.session.lastActivityAt = nowMs;
    req.session.deployBootId = SERVER_BOOT_ID;

    if (rememberMe === false) {
        req.session.cookie.maxAge = null;
    } else {
        req.session.cookie.maxAge = PORTAL_SESSION_MAX_AGE_MS;
    }
}

function destroyPortalSessionForDeploy(req, res, callback) {
    const finish = typeof callback === 'function' ? callback : () => {};
    if (typeof req.session?.destroy === 'function') {
        return req.session.destroy((err) => {
            if (err) {
                console.warn('[NEXUS] Deploy session destroy failed:', err);
            }
            if (res && typeof res.clearCookie === 'function') {
                res.clearCookie('royalArmiesPortalSid');
            }
            finish();
        });
    }
    if (res && typeof res.clearCookie === 'function') {
        res.clearCookie('royalArmiesPortalSid');
    }
    finish();
}

function rejectStaleDeployPortalSession(req, res, next) {
    const username = String(req.session?.username || '').trim();
    if (!username) return next();

    const sessionBoot = String(req.session.deployBootId || '').trim();
    if (sessionBoot === SERVER_BOOT_ID) return next();

    destroyPortalSessionForDeploy(req, res, next);
}

/* Local dev: allow Live Server / static preview origins to call the API on port 3000 */
if (!isProduction) {
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dev-Key, Authorization, X-Royal-Armies-Live-Preview');
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });
}

app.use((req, res, next) => {
    const username = String(req.session?.username || '').trim();
    if (!username) return next();

    const path = String(req.path || '');
    const inactivityExemptPaths = new Set([
        '/api/login',
        '/api/register',
        '/api/auth/logout',
        '/api/auth/session',
        '/api/auth/dev-session',
        '/api/portal/metrics',
        '/api/portal/presence',
        '/api/portal/presence/leave',
        '/api/portal/legal/terms-version'
    ]);
    if (inactivityExemptPaths.has(path)) return next();

    if (rejectInactivePortalSession(req, res)) return;
    next();
});

const PUBLIC_DIR = path.join(__dirname, 'public');
const SEASON_0_DIR = path.join(__dirname, 'Season 0');

const PORTAL_HTML_PAGES = {
    main: 'main.html',
    game: 'game.html',
    'reset-password': 'reset-password.html',
    terms: 'terms.html'
};

const OFFICIAL_AGE_HTML_PAGES = {
    agealpha: 'agealpha.html',
    headquarters: 'headquarters.html'
};

const ALL_HTML_PAGE_ROUTES = {
    ...PORTAL_HTML_PAGES,
    ...OFFICIAL_AGE_HTML_PAGES
};

/* Extensionless canonical URLs — serve at /slug, redirect legacy /slug.html (before static). */
function redirectWithQuery(req, res, targetPath) {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
    res.redirect(301, `${targetPath}${query}`);
}

app.get(['/ageportal', '/ageportal.html', '/index.html', '/', '/index'], (req, res) => {
    redirectWithQuery(req, res, '/main');
});

app.get(['/legal', '/legal.html'], (req, res) => {
    redirectWithQuery(req, res, '/terms');
});

app.get(['/how-did-you-get-here', '/how-did-you-get-here.html'], (req, res) => {
    redirectWithQuery(req, res, '/game');
});

app.get(['/settlement', '/settlement.html'], (req, res) => {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex >= 0 ? req.url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(query);
    if (!params.has('openSettlement')) {
        params.set('openSettlement', '1');
    }
    const nextQuery = params.toString();
    res.redirect(301, `/agealpha${nextQuery ? `?${nextQuery}` : ''}`);
});

app.get(['/council-room', '/council-room.html'], (req, res) => {
    redirectWithQuery(req, res, '/headquarters');
});

Object.entries(ALL_HTML_PAGE_ROUTES).forEach(([slug, fileName]) => {
    app.get(`/${slug}`, (req, res) => {
        res.sendFile(path.join(PUBLIC_DIR, fileName));
    });

    app.get(`/${fileName}`, (req, res) => {
        redirectWithQuery(req, res, `/${slug}`);
    });
});

/* Block 6b: Portal maintenance alert API (before static so routes are never shadowed) */
app.get('/api/portal/maintenance-alert', (req, res) => {
    res.json(getPortalMaintenanceAlert());
});

app.post('/api/portal/maintenance-alert', (req, res) => {
    const devKey = String(req.headers['x-dev-key'] || req.body?.devKey || '').trim();
    if (!devKey || devKey !== MAINTENANCE_ALERT_DEV_KEY) {
        return sendApiError(res, 'NEXUS-AUTH-011');
    }

    const payload = setPortalMaintenanceAlert(req.body || {});
    res.json({ status: 'ok', ...payload });
});

/** Unlisted Age of War trailer — direct URL only; not linked from site nav or dev tools. */
const AGE_OF_WAR_TRAILER_FILE = 'ageofwar-trailer.html';
function sendAgeOfWarTrailerPage(res) {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(path.join(PUBLIC_DIR, AGE_OF_WAR_TRAILER_FILE));
}

app.get(['/ageofwar-trailer', '/ageofwar-trailer.html'], (req, res) => {
    sendAgeOfWarTrailerPage(res);
});

app.get(['/royalarmies-ageofwar-trailer', '/royalarmies-ageofwar-trailer.html'], (req, res) => {
    redirectWithQuery(req, res, '/ageofwar-trailer');
});

app.use('/season-0', express.static(SEASON_0_DIR, {
    setHeaders(res, filePath) {
        if (/\.(svg|png)$/i.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=300, must-revalidate');
        }
    }
}));

app.use(express.static(PUBLIC_DIR, {
    setHeaders(res, filePath) {
        if (path.basename(filePath) === AGE_OF_WAR_TRAILER_FILE) {
            res.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
            res.set('Cache-Control', 'private, no-store');
        }
        if (path.basename(filePath) === 'royal-armies-age-of-war-trailer.mp4') {
            res.set('Cache-Control', 'public, max-age=300, must-revalidate');
        }
    }
}));

/* --- Section: Email Dispatch Engine --- */

/* Block 7: Welcome Verification Scroll Generator */
const sendWelcomeEmail = async (playerEmail, playerName, token) => {
    try {
        const verificationLink = `https://royalarmies.com/verify?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Email Verification: Royal Armies',
            html: `
                <div style="font-family: 'Georgia', serif; background-color: #000; color: #f1e0ac; padding: 40px; border: 2px solid #d4af37; text-align: center;">
                    <h1 style="color: #d4af37; text-align: center;">WELCOME, COMMANDER ${playerName.toUpperCase()}</h1>
                    
                    <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic;">
                        Your registration for the Royal Armies MMORTS has been logged. 
                        Please proceed to verify your e-mail by clicking the link below.
                    </p>
                    
                    <div style="margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #d4af37; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase; display: inline-block;">
                            Verify E-Mail
                        </a>
                    </div>

                    <p style="font-size: 0.8rem; color: #888;">If the button above does not work, copy and paste this link:<br>${verificationLink}</p>
                    
                    <hr style="border: 0; border-top: 1px solid #d4af37; margin: 20px 0;" />
                    <p style="text-align: center; color: #888;">© 2026 GREEN MASK INTERACTIVE</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Resend Error:", error);
            throw error; 
        }
        console.log("📜 Verification Scroll Sent! ID:", data.id);
        return data;
    } catch (err) {
        console.error("❌ Fatal Post Office Failure:", err);
        throw err; 
    }
};

const PORTAL_PASSWORD_RESET_OK_MESSAGE =
    'If that email matches your account, a password reset link has been sent. Check your inbox.';

const sendPasswordResetEmail = async (req, commanderEmail, commanderUsername, resetToken) => {
    const origin = getPublicSiteOrigin(req);
    const resetLink = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [commanderEmail],
        subject: '📜 Password Reset: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>COMMANDER ${String(commanderUsername).toUpperCase()}</h1>
                <p style="font-style: italic;">Use the link below to set a new password for your Royal Armies account.</p>
                <div style="margin:30px 0;">
                    <a href="${resetLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${resetLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
};

const sendEmailChangeVerificationEmail = async (req, newEmail, commanderUsername, emailChangeToken) => {
    const origin = getPublicSiteOrigin(req);
    const verifyLink = `${origin}/verify-email-change?token=${encodeURIComponent(emailChangeToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [newEmail],
        subject: '📜 Confirm Your New Email: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>CONFIRM EMAIL CHANGE</h1>
                <p style="font-style: italic;">Commander <strong>${String(commanderUsername).toUpperCase()}</strong> requested to update the account email to this address.</p>
                <p>Click below to confirm. If you did not request this, ignore this message.</p>
                <div style="margin:30px 0;">
                    <a href="${verifyLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Confirm New Email
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${verifyLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
};

/* --- Section: API Route Handlers --- */

/* Block 8: Commander Registration Endpoint */
app.post('/register', async (req, res) => {
    const email = normalizeLedgerEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
        return sendApiError(res, 'NEXUS-AUTH-005');
    }

    const usernameValidation = validateRegistrationUsername(req.body?.username);
    if (!usernameValidation.ok) {
        return sendApiError(res, usernameValidation.code);
    }

    const username = usernameValidation.username;

    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => normalizeLedgerEmail(entry?.email) === email);
    const usernameTaken = commanders.some(
        (entry) => String(entry?.username || '').trim().toLowerCase() === username.toLowerCase()
    );

    if (emailTaken) {
        console.log(`[NEXUS] Registration Denied: ${email} already exists.`);
        return sendApiError(res, 'NEXUS-AUTH-006');
    }

    if (usernameTaken) {
        console.log(`[NEXUS] Registration Denied: ${username} already exists.`);
        return sendApiError(res, 'NEXUS-AUTH-007');
    }

    const termsAccepted = req.body?.termsAccepted === true
        || req.body?.termsAccepted === 'true'
        || req.body?.agreeToTerms === true
        || req.body?.agreeToTerms === 'true';
    if (!termsAccepted) {
        return sendApiError(res, 'NEXUS-AUTH-015');
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const token = crypto.randomBytes(16).toString('hex');
        const joinedAt = new Date().toISOString();
        const termsVersion = String(req.body?.termsVersion || LEGAL_TERMS_VERSION).trim().slice(0, 32) || LEGAL_TERMS_VERSION;
        console.log(`[NEXUS] Handshake Received: Creating ledger entry for ${username}`);

        db.get('commanders').push({ 
            username,
            email,
            password: hashedPassword,
            token,
            verified: false,
            joinedAt,
            termsAccepted: true,
            termsAcceptedAt: joinedAt,
            terms_accepted_at: joinedAt,
            termsVersion,
            bio: '',
            privacy: 'Public',
            avatarUrl: '',
            country: '',
            timezone: '',
            gameNation: '',
            allianceId: '',
            ageHistory: [],
            awards: [],
            medals: [],
            membershipTitle: 'Basic',
            premiumMember: false,
            chronicleXp: getDefaultCommanderChronicleXp(),
            ageResetUsage: {},
            preferences: getDefaultCommanderPreferences(),
            ...buildCommanderRegistrationAuditPatch(req)
        }).write();

        console.log(`[NEXUS] Success: ${username} added to the Ledger.`);

        let emailSent = false;
        try {
            await sendWelcomeEmail(email, username, token);
            emailSent = true;
        } catch (emailError) {
            console.error(`[NEXUS] Ledger saved for ${username}, but verification email failed:`, emailError);
        }

        res.status(200).json({
            status: 'logged',
            emailSent,
            username,
            message: emailSent
                ? 'Registration saved. Check your email for the confirmation scroll.'
                : 'Registration saved, but the verification email could not be sent. You may still log in; contact accountsdept@royalarmies.com if you need the verify link resent.'
        });
    } catch (error) {
        console.error('❌ NEXUS Critical Error:', error);
        return sendApiError(res, 'NEXUS-AUTH-008', { http: 500 });
    }
});

/* Block 8b: Commander Login (ledger-backed) */
app.post('/api/login', async (req, res) => {
    const identifier = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
        return sendApiError(res, 'NEXUS-AUTH-001');
    }

    const commander = findCommanderByUsernameOrEmail(identifier);
    if (!commander || !commander.password) {
        return sendApiError(res, 'NEXUS-AUTH-002');
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return sendApiError(res, 'NEXUS-AUTH-003');
        }

        const rememberMe = req.body?.rememberMe !== false;
        setPortalSessionForUser(req, commander.username, rememberMe);

        const achievementUnlocks = [];
        const firstTimerResult = ensureFirstTimerAchievementForCommander(commander);
        if (firstTimerResult.added && firstTimerResult.record) {
            achievementUnlocks.push(firstTimerResult.record);
        }

        ensureWelcomeSystemMessageForCommander(commander.username);

        const localePatch = buildCommanderDossierPatch({
            country: req.body?.country,
            timezone: req.body?.timezone
        });
        if (localePatch.country || localePatch.timezone) {
            db.get('commanders')
                .find({ username: commander.username })
                .assign(localePatch)
                .write();
        }

        db.get('commanders')
            .find({ username: commander.username })
            .assign(buildCommanderLoginAuditPatch(req))
            .write();

        const requiresTermsAcceptance = isLiveServerPort5500Request(req)
            ? false
            : !commanderHasAcceptedTerms(commander);

        res.status(200).json({
            status: requiresTermsAcceptance ? 'terms_required' : 'success',
            username: commander.username,
            verified: !!commander.verified,
            rememberMe,
            requiresTermsAcceptance,
            termsVersion: LEGAL_TERMS_VERSION,
            achievementUnlocks: requiresTermsAcceptance ? [] : achievementUnlocks
        });
    } catch (error) {
        console.error('[NEXUS] Login compare failed:', error);
        return sendApiError(res, 'NEXUS-AUTH-004', { http: 500 });
    }
});

app.get('/api/auth/session', (req, res) => {
    const username = String(req.session?.username || '').trim();
    if (!username) {
        return res.json({ authenticated: false });
    }

    if (isPortalSessionInactive(req)) {
        return destroyPortalSessionForInactivity(req, res, () => {
            res.json({
                authenticated: false,
                inactivityLogout: true,
                requiresTermsAcceptance: false,
                termsVersion: LEGAL_TERMS_VERSION
            });
        });
    }

    const commander = findCommanderByUsername(username);
    const termsAcceptedAt = commander ? getCommanderTermsAcceptedAt(commander) : null;
    const requiresTermsAcceptance = isLiveServerPort5500Request(req)
        ? false
        : (commander ? !commanderHasAcceptedTerms(commander) : false);
    res.json({
        authenticated: true,
        username,
        requiresTermsAcceptance,
        termsAcceptedAt,
        terms_accepted_at: termsAcceptedAt,
        termsVersion: LEGAL_TERMS_VERSION,
        lastActivityAt: getPortalSessionLastActivityAt(req)
    });
});

app.post('/api/portal/account/accept-terms', (req, res) => {
    const sessionUsername = String(req.session?.username || '').trim();
    const bodyUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    const username = sessionUsername || resolvePortalAccountUsername(bodyUsername, req);

    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    if (sessionUsername && bodyUsername && bodyUsername.toLowerCase() !== sessionUsername.toLowerCase()) {
        return sendApiError(res, 'NEXUS-AUTH-011');
    }

    if (!sessionUsername && username) {
        setPortalSessionForUser(req, username, true);
    }

    const agreed = req.body?.termsAccepted === true
        || req.body?.termsAccepted === 'true'
        || req.body?.agreeToTerms === true
        || req.body?.agreeToTerms === 'true';
    if (!agreed) {
        return sendApiError(res, 'NEXUS-AUTH-015');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const updated = applyTermsAcceptanceToCommander(
        commander.username,
        req.body?.termsVersion
    );

    const achievementUnlocks = [];
    const firstTimerResult = ensureFirstTimerAchievementForCommander(updated || commander);
    if (firstTimerResult.added && firstTimerResult.record) {
        achievementUnlocks.push(firstTimerResult.record);
    }

    const acceptedAt = getCommanderTermsAcceptedAt(updated || commander);
    const successToken = crypto.randomBytes(24).toString('hex');

    touchPortalSessionActivity(req, Date.now());

    res.status(200).json({
        status: 'success',
        username: updated?.username || commander.username,
        termsAcceptedAt: acceptedAt,
        terms_accepted_at: acceptedAt,
        termsVersion: updated?.termsVersion || LEGAL_TERMS_VERSION,
        requiresTermsAcceptance: false,
        successToken,
        achievementUnlocks
    });
});

app.get('/api/portal/legal/terms-version', (req, res) => {
    res.json({
        termsVersion: LEGAL_TERMS_VERSION,
        termsUrl: '/terms'
    });
});

/** Standby — returns 501 until payment processor checkout is wired. */
app.post('/api/portal/billing/royalty/checkout-session', (req, res) => {
    const username = String(req.session?.username || '').trim();
    if (!username) {
        return sendApiError(res, 'NEXUS-AUTH-001');
    }

    return res.status(501).json({
        status: 'standby',
        checkoutLive: false,
        message: 'Royalty membership billing is not connected yet.',
        termsUrl: '/terms'
    });
});

/** Local port 3000 only — bootstrap session as caleb_admin for full portal QA. */
app.post('/api/auth/dev-session', (req, res) => {
    if (isProduction) {
        return sendApiError(res, 'NEXUS-AUTH-009');
    }

    const host = String(req.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
        return sendApiError(res, 'NEXUS-AUTH-010');
    }

    const mode = String(req.body?.mode || 'owner').toLowerCase();
    const username = mode === 'player' ? 'DevPlayer' : 'caleb_admin';
    ensureLocalDevCommanderInLedger(username, req);
    setPortalSessionForUser(req, username, true);
    res.json({ authenticated: true, username, dev: true, mode: mode === 'player' ? 'player' : 'owner' });
});

/** Local dev only — switch commander nation and re-seed movement to that nation's capital. */
app.post('/api/dev/switch-nation', (req, res) => {
    if (isProduction) {
        return sendApiError(res, 'NEXUS-GEN-001');
    }

    const host = String(req.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
        return sendApiError(res, 'NEXUS-GEN-001');
    }

    const sessionUsername = String(req.session?.username || '').trim();
    const bodyUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    const username = sessionUsername || bodyUsername;
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    if (sessionUsername && bodyUsername && bodyUsername.toLowerCase() !== sessionUsername.toLowerCase()) {
        return sendApiError(res, 'NEXUS-AUTH-011');
    }

    const ledgerPatch = buildDevNationSwitchLedgerPatch(req.body?.nationId);
    if (!ledgerPatch) {
        return sendApiError(res, 'NEXUS-GAME-012');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    db.get('commanders')
        .find({ username })
        .assign(ledgerPatch)
        .write();

    const updated = db.get('commanders').find({ username }).value();
    ensureCommanderAgeRoster(updated);
    const rosterCommander = db.get('commanders').find({ username }).value();
    const movementNation = resolveCommanderMapNationKey(rosterCommander);
    const reconciledMovement = normalizeCommanderMovementRecord(
        readCommanderMovementRecord(username, movementNation),
        movementNation
    );
    writeCommanderMovementRecord(username, reconciledMovement);

    const dossier = serializeCommanderDossierForClient(updated);

    res.json({
        status: 'ok',
        gameNation: ledgerPatch.gameNation,
        regionId: ledgerPatch.onboardingRegionId,
        dossier,
        movement: buildAgeMovementStatePayload(username, rosterCommander)
    });
});

app.post('/api/auth/logout', (req, res) => {
    const finish = () => res.json({ status: 'ok' });
    if (typeof req.session?.destroy === 'function') {
        return req.session.destroy((err) => {
            if (err) {
                console.warn('[NEXUS] Session destroy failed:', err);
            }
            res.clearCookie('royalArmiesPortalSid');
            finish();
        });
    }
    res.clearCookie('royalArmiesPortalSid');
    finish();
});

/* Block 9: Password Reset Request Dispatch */
app.post('/request-reset', async (req, res) => {
    const email = normalizeLedgerEmail(req.body?.email);
    console.log(`[NEXUS] Recovery Handshake: Request for ${email}`);
    const commander = findCommanderByUsernameOrEmail(email);

    if (!commander) {
        console.log('⚠️ Recovery Denied: Email not in Ledger.');
        return res.status(200).json({ status: 'success' });
    }

    const resetToken = crypto.randomBytes(16).toString('hex');
    db.get('commanders')
        .find({ username: commander.username })
        .assign({ resetToken })
        .write();

    try {
        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[NEXUS] Password reset email failed:', err);
        return sendApiError(res, 'NEXUS-ACCT-002', { http: 500 });
    }
});

/* Block 11: Final Password Reset & Token Destruction */
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    const commander = db.get('commanders').find({ resetToken: token }).value();

    if (!commander) {
        console.log("⚠️ Invalid or already-used token attempted.");
        return res.status(400).json({ status: "error", message: "Invalid Scroll." });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        db.get('commanders')
          .find({ email: commander.email })
          .assign({ 
              password: hashedPassword, 
              resetToken: null
          })
          .write();

        console.log(`[NEXUS] Password reset successful for: ${commander.username}`);
        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error" });
    }
});

/* Block 12: Email Verification Landing Pad */
app.get('/verify', (req, res) => {
    const token = req.query.token;
    const commander = db.get('commanders').find({ token }).value();
    if (commander) {
        db.get('commanders').find({ token }).assign({ verified: true }).write();
        res.send(`
            <body style="background: #000; color: #d4af37; font-family: Georgia, serif; text-align: center; padding: 100px 20px; border: 10px solid #1a1a1a; height: 100vh; margin: 0;">
                <h1 style="font-size: 3rem;">EMAIL VERIFIED</h1>
                <p>Thank You for verifying your E-Mail, ${commander.username}.</p>
                <a href="https://royalarmies.com" style="color: #fff;">Return to Royal Armies</a>
            </body>`);
    } else {
        res.status(400).send("<h1>❌ INVALID TOKEN</h1>");
    }
});

/* Block 12b: Portal account security (profile settings) */
app.get('/api/portal/account/security-profile', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-006');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.status(200).json({
        status: 'ok',
        email: commander.email || '',
        verified: !!commander.verified
    });
});

app.get('/api/portal/commanders/:username/public-profile', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.params?.username || '');
    if (!username || isHiddenRegistrationUsername(username)) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const dossier = serializeCommanderDossierForClient(commander);
    const prefs = normalizeCommanderPreferences(commander.preferences);
    res.status(200).json({
        ...dossier,
        rank: Number(commander.rank) || 1,
        path: String(commander.path || '').slice(0, 16),
        rankTitleGender: prefs.rankTitleGender,
        country: String(commander.country || '—').slice(0, 120),
        timezone: String(commander.timezone || '—').slice(0, 120)
    });
});

app.get('/api/portal/account/profile', (req, res) => {
    const username = resolvePortalAccountUsername(req.query?.username || '', req);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.status(200).json(serializeCommanderProfileForClient(commander));
});

app.patch('/api/portal/account/profile', (req, res) => {
    const username = resolvePortalAccountUsername(req.body?.username || '', req);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const patch = buildCommanderDossierPatch({
        bio: req.body?.bio,
        privacy: req.body?.privacy,
        avatarUrl: req.body?.avatarUrl
    });
    if (!Object.keys(patch).length) {
        return sendApiError(res, 'NEXUS-ACCT-008');
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign(patch)
        .write();

    const updated = findCommanderByUsername(username);
    res.status(200).json(serializeCommanderProfileForClient(updated));
});

app.get('/api/portal/account/dossier', (req, res) => {
    const username = resolvePortalAccountUsername(req.query?.username || '', req);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.status(200).json(serializeCommanderDossierForClient(commander));
});

app.patch('/api/portal/account/dossier', (req, res) => {
    const username = resolvePortalAccountUsername(req.body?.username || '', req);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const rawPatch = req.body?.patch || req.body;
    if (!isBattlePassServerEnabled() && dossierPatchIncludesBattlePassFields(rawPatch)) {
        return sendApiError(res, 'NEXUS-GAME-015');
    }

    const patch = buildCommanderDossierPatch(rawPatch);
    if (!Object.keys(patch).length) {
        return sendApiError(res, 'NEXUS-ACCT-009');
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign(patch)
        .write();

    const updated = findCommanderByUsername(username);
    res.status(200).json(serializeCommanderDossierForClient(updated));
});

app.post('/api/portal/account/request-password-reset', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const email = normalizeLedgerEmail(req.body?.email);

    if (!username || !email) {
        return sendApiError(res, 'NEXUS-ACCT-001');
    }

    const commander = findCommanderByUsername(username);
    const emailMatches = commander && normalizeLedgerEmail(commander.email) === email;

    if (!emailMatches) {
        console.log(`[NEXUS] Portal password reset denied for ${username} (email mismatch or unknown).`);
        return res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    }

    try {
        const resetToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({ resetToken })
            .write();

        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        console.log(`[NEXUS] Portal password reset email sent for ${commander.username}`);
        res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    } catch (err) {
        console.error('[NEXUS] Portal password reset email failed:', err);
        return sendApiError(res, 'NEXUS-ACCT-002', { http: 500 });
    }
});

app.post('/api/portal/account/request-email-change', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const newEmail = normalizeLedgerEmail(req.body?.newEmail);

    if (!username || !password || !newEmail) {
        return sendApiError(res, 'NEXUS-ACCT-003');
    }

    const commander = findCommanderByUsername(username);
    if (!commander || !commander.password) {
        return sendApiError(res, 'NEXUS-ACCT-004');
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return sendApiError(res, 'NEXUS-ACCT-004');
        }

        if (normalizeLedgerEmail(commander.email) === newEmail) {
            return sendApiError(res, 'NEXUS-ACCT-005');
        }

        const commanders = db.get('commanders').value() || [];
        const emailTaken = commanders.some((entry) => {
            if (!entry) return false;
            if (String(entry.username || '').trim().toLowerCase() === username.toLowerCase()) {
                return false;
            }
            return normalizeLedgerEmail(entry.email) === newEmail;
        });

        if (emailTaken) {
            return sendApiError(res, 'NEXUS-ACCT-006');
        }

        const emailChangeToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: newEmail,
                emailChangeToken,
                emailChangeRequestedAt: new Date().toISOString()
            })
            .write();

        await sendEmailChangeVerificationEmail(req, newEmail, commander.username, emailChangeToken);
        console.log(`[NEXUS] Email change confirmation sent for ${commander.username} → ${newEmail}`);

        res.status(200).json({
            status: 'ok',
            message: `A confirmation link was sent to ${newEmail}. Open that inbox and click the link to finish updating your email.`
        });
    } catch (err) {
        console.error('[NEXUS] Email change request failed:', err);
        return sendApiError(res, 'NEXUS-ACCT-007', { http: 500 });
    }
});

app.get('/verify-email-change', (req, res) => {
    const token = String(req.query?.token || '').trim();
    const commander = db.get('commanders').find({ emailChangeToken: token }).value();

    if (!commander || !commander.pendingNewEmail) {
        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>INVALID OR EXPIRED LINK</h1>
                <p>This email change link is no longer valid.</p>
                <a href="/main" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    const newEmail = normalizeLedgerEmail(commander.pendingNewEmail);
    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => {
        if (!entry) return false;
        if (String(entry.username || '').trim().toLowerCase() === String(commander.username).trim().toLowerCase()) {
            return false;
        }
        return normalizeLedgerEmail(entry.email) === newEmail;
    });

    if (emailTaken) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: null,
                emailChangeToken: null,
                emailChangeRequestedAt: null
            })
            .write();

        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>EMAIL UNAVAILABLE</h1>
                <p>That address is already registered to another commander. Request a new change from your profile.</p>
                <a href="/main" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign({
            email: newEmail,
            pendingNewEmail: null,
            emailChangeToken: null,
            emailChangeRequestedAt: null
        })
        .write();

    console.log(`[NEXUS] Email updated for ${commander.username} → ${newEmail}`);
    res.send(`
        <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
            <h1>EMAIL UPDATED</h1>
            <p>Your account email for <strong>${commander.username}</strong> is now <strong>${newEmail}</strong>.</p>
            <a href="/main" style="color:#fff;">Return to portal</a>
        </body>`);
});

/* Block 13: Age Portal live metrics & presence */
app.get('/api/portal/error-codes', (req, res) => {
    res.json({ status: 'ok', codes: listErrorCodes() });
});

app.get('/api/portal/metrics', (req, res) => {
    res.json(getPortalLiveMetricsPayload());
});

app.get('/api/portal/trailer/render/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(getTrailerRenderStatusPayload(db));
});

app.post('/api/portal/trailer/render/progress', (req, res) => {
    if (!verifyTrailerRenderSyncSecret(req)) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const status = writeTrailerRenderRemoteStatus(
        db,
        sanitizeTrailerRenderProgressPayload(req.body)
    );
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', render: status });
});

app.post('/api/portal/trailer/render/start', (req, res) => {
    if (!canStartTrailerRenderFromRequest(req)) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const previewSec = Math.max(0, Number(req.body?.previewSec) || 0);
    const result = startTrailerRenderJob({ previewSec });
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', ...result });
});

app.get('/api/portal/mailbox-recipient-roster', (req, res) => {
    const requester = normalizeLedgerUsername(req.query?.requester || '');
    if (!isMailboxRecipientRosterAdmin(requester)) {
        return res.json({ allowed: false });
    }

    const commanders = db.get('commanders').value() || [];
    const visible = commanders
        .filter((entry) => entry?.username && !isHiddenRegistrationUsername(entry.username))
        .map((entry) => ({
            username: entry.username,
            verified: !!entry.verified
        }))
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    const all = visible.map((entry) => entry.username);
    const verified = visible.filter((entry) => entry.verified).map((entry) => entry.username);
    const unverified = visible.filter((entry) => !entry.verified).map((entry) => entry.username);

    res.json({
        allowed: true,
        categories: { all, verified, unverified }
    });
});

app.get('/api/portal/mailbox', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const payload = getMailboxPayloadForUser(username);
    if (payload.status === 'error') {
        return res.status(404).json(payload);
    }

    res.json(payload);
});

app.post('/api/portal/mailbox/send', (req, res) => {
    const sender = resolveLedgerCommanderUsername(req.body?.sender || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX);
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);

    if (!sender) {
        return sendApiError(res, 'NEXUS-MAIL-001');
    }
    if (!topic || !body) {
        return sendApiError(res, 'NEXUS-MAIL-002');
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
        if (recipients.length >= MAILBOX_RECIPIENTS_MAX) break;
    }

    if (!recipients.length) {
        return sendApiError(res, 'NEXUS-MAIL-003');
    }

    const sentAt = new Date().toISOString();
    const messages = getMailboxMessageStore();
    const created = [];
    let idSeed = Date.now();

    recipients.forEach((recipient) => {
        const row = {
            id: createMailboxRecordId(idSeed),
            channel: 'inbox',
            from: sender,
            to: recipient,
            topic,
            body,
            read: false,
            sentAt
        };
        idSeed += 1;
        messages.push(row);
        created.push(serializeMailboxMessageForClient(row));
    });

    const sentRow = {
        id: createMailboxRecordId(idSeed),
        channel: 'sent',
        from: sender,
        recipients: recipients.slice(),
        to: recipients.join(', '),
        topic,
        body,
        read: true,
        sentAt
    };
    messages.push(sentRow);

    writeMailboxMessageStore(messages);

    res.status(200).json({
        status: 'ok',
        delivered: created.length,
        recipients,
        messages: created,
        sent: serializeMailboxSentForClient(sentRow)
    });
});

app.post('/api/portal/mailbox/inject', (req, res) => {
    const to = resolveLedgerCommanderUsername(req.body?.to || req.body?.recipient || '');
    const channel = String(req.body?.channel || 'inbox').toLowerCase();
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'No subject';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);
    const systemMessageKey = String(req.body?.systemMessageKey || '').trim().slice(0, 80);

    if (!to) {
        return sendApiError(res, 'NEXUS-MAIL-004');
    }
    if (channel !== 'inbox' && channel !== 'system') {
        return sendApiError(res, 'NEXUS-MAIL-005');
    }

    const from = channel === 'system'
        ? WELCOME_SYSTEM_MESSAGE_FROM
        : String(req.body?.from || '').trim().slice(0, 80);

    if (channel === 'inbox' && !from) {
        return sendApiError(res, 'NEXUS-MAIL-006');
    }

    const messages = getMailboxMessageStore();
    if (channel === 'system' && systemMessageKey) {
        const ownerLower = to.toLowerCase();
        const alreadyDelivered = messages.some(
            (row) => row
                && row.channel === 'system'
                && String(row.to || '').toLowerCase() === ownerLower
                && row.systemMessageKey === systemMessageKey
        );
        if (alreadyDelivered) {
            return res.status(200).json({ status: 'ok', message: 'System message already delivered.', skipped: true });
        }
    }

    const sentAt = new Date().toISOString();
    const row = {
        id: createMailboxRecordId(),
        channel,
        from,
        to,
        topic,
        body,
        read: false,
        sentAt
    };

    if (channel === 'system') {
        row.bodyFormat = req.body?.bodyFormat === 'html' ? 'html' : 'text';
        if (systemMessageKey) row.systemMessageKey = systemMessageKey;
    }

    messages.push(row);
    writeMailboxMessageStore(messages);

    res.status(200).json({ status: 'ok', message: serializeMailboxMessageForClient(row) });
});

app.patch('/api/portal/mailbox/:messageId/read', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);

    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-007');
    }
    if (!Number.isFinite(messageId)) {
        return sendApiError(res, 'NEXUS-CHAT-005');
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const hit = messages.find(
        (row) => row.id === messageId && String(row.to || '').toLowerCase() === ownerLower
    );

    if (!hit) {
        return sendApiError(res, 'NEXUS-MAIL-008');
    }

    hit.read = true;
    writeMailboxMessageStore(messages);

    res.json({ status: 'ok', message: serializeMailboxMessageForClient(hit) });
});

app.delete('/api/portal/mailbox/:messageId', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);
    const channel = String(req.body?.channel || req.query?.channel || 'inbox').toLowerCase();

    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-007');
    }
    if (!Number.isFinite(messageId)) {
        return sendApiError(res, 'NEXUS-CHAT-005');
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const nextMessages = messages.filter((row) => {
        if (row.id !== messageId) return true;
        if (channel === 'sent') {
            return !(
                row.channel === 'sent'
                && String(row.from || '').toLowerCase() === ownerLower
            );
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system') return row.channel === 'system';
        return row.channel === 'inbox';
    });

    if (nextMessages.length === messages.length) {
        return sendApiError(res, 'NEXUS-MAIL-008');
    }

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removedId: messageId });
});

app.post('/api/portal/mailbox/purge', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    const channel = String(req.body?.channel || 'inbox').toLowerCase();
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = new Set(idsRaw.map((id) => Number(id)).filter((id) => Number.isFinite(id)));

    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-007');
    }
    if (!ids.size) {
        return sendApiError(res, 'NEXUS-MAIL-009');
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    let removed = 0;
    const nextMessages = messages.filter((row) => {
        if (!ids.has(row.id)) return true;
        if (channel === 'sent') {
            if (row.channel !== 'sent' || String(row.from || '').toLowerCase() !== ownerLower) return true;
            removed += 1;
            return false;
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system' && row.channel !== 'system') return true;
        if (channel !== 'system' && row.channel !== 'inbox') return true;
        removed += 1;
        return false;
    });

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removed });
});

app.post('/api/portal/mailbox/drafts', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.owner || req.body?.username || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'Untitled Draft';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);
    const draftId = Number(req.body?.id);

    if (!owner) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
    }

    const updatedAt = new Date().toISOString();
    const drafts = getMailboxDraftStore();
    let row;

    if (Number.isFinite(draftId)) {
        const hit = drafts.find(
            (entry) => entry.id === draftId && String(entry.owner || '').toLowerCase() === owner.toLowerCase()
        );
        if (hit) {
            hit.recipients = recipients;
            hit.topic = topic;
            hit.body = body;
            hit.updatedAt = updatedAt;
            row = hit;
        }
    }

    if (!row) {
        row = {
            id: createMailboxRecordId(),
            owner,
            recipients,
            topic,
            body,
            updatedAt
        };
        drafts.unshift(row);
    }

    writeMailboxDraftStore(drafts);
    res.status(200).json({ status: 'ok', draft: serializeMailboxDraftForClient(row) });
});

app.delete('/api/portal/mailbox/drafts/:draftId', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const draftId = Number(req.params.draftId);

    if (!owner) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }
    if (!Number.isFinite(draftId)) {
        return sendApiError(res, 'NEXUS-MAIL-010');
    }

    const ownerLower = owner.toLowerCase();
    const drafts = getMailboxDraftStore();
    const nextDrafts = drafts.filter((row) => {
        if (row.id !== draftId) return true;
        return String(row.owner || '').toLowerCase() !== ownerLower;
    });

    if (nextDrafts.length === drafts.length) {
        return sendApiError(res, 'NEXUS-MAIL-011');
    }

    writeMailboxDraftStore(nextDrafts);
    res.json({ status: 'ok', removedId: draftId });
});

function getCommunityChatMentionRosterPayload() {
    const commanders = db.get('commanders').value() || [];
    const usernames = commanders
        .filter((entry) => entry?.username && !isHiddenRegistrationUsername(entry.username))
        .map((entry) => String(entry.username).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return { status: 'ok', usernames };
}

app.get('/api/portal/community-chat/mention-roster', (req, res) => {
    res.json(getCommunityChatMentionRosterPayload());
});

app.get('/api/portal/community-chat', (req, res) => {
    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);
    writeCommunityChatStore(store);

    const channel = String(req.query?.channel || '').trim();
    const messages = flattenCommunityChatActiveMessages(store);
    const messagesByChannel = {};
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        messagesByChannel[channelId] = store.channels[channelId];
    });

    const viewerUsername = resolveLedgerCommanderUsername(req.query?.username || '');
    const viewerRestrictions = viewerUsername
        ? serializeCommunityChatRestrictionsForClient(viewerUsername, store)
        : null;

    res.json({
        status: 'ok',
        messages,
        messagesByChannel,
        channelMessages: channel && isCommunityChatChannelId(channel) ? store.channels[channel] : null,
        retention: getCommunityChatRetentionMeta(store),
        viewerRestrictions
    });
});

app.post('/api/portal/community-chat/messages', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || req.body?.posterUsername || '');
    if (!posterUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);

    const posterCommander = findCommanderByUsername(posterUsername);
    const result = appendCommunityChatMessageToStore(store, {
        ...req.body,
        posterUsername,
        ...buildChatSenderRankMeta(posterCommander)
    });

    if (result.errorCode || result.error) {
        return sendStoreError(res, result);
    }

    store = writeCommunityChatStore(store);

    res.json({
        status: 'ok',
        message: result.entry,
        channelMessages: result.channelMessages,
        messages: flattenCommunityChatActiveMessages(store),
        retention: getCommunityChatRetentionMeta(store),
        viewerRestrictions: serializeCommunityChatRestrictionsForClient(posterUsername, store)
    });
});

app.post('/api/portal/community-chat/restrictions', (req, res) => {
    const moderator = resolveLedgerCommanderUsername(req.body?.username || req.body?.moderatorUsername || '');
    if (!moderator || !isMailboxRecipientRosterAdmin(moderator)) {
        return sendApiError(res, 'NEXUS-CHAT-009');
    }

    const targetUsername = resolveLedgerCommanderUsername(req.body?.targetUsername || req.body?.offender || '');
    if (!targetUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);

    const result = applyCommunityChatRestrictionToStore(store, targetUsername, req.body?.action);
    if (result.errorCode || result.error) {
        return sendStoreError(res, result);
    }

    store = writeCommunityChatStore(store);

    res.json({
        status: 'ok',
        targetUsername: result.targetUsername,
        restrictions: result.restrictions
    });
});

app.post('/api/portal/player-reports', (req, res) => {
    const reporterUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!reporterUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const reporter = db.get('commanders').find({ username: reporterUsername }).value();
    if (!reporter) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }
    if (!commanderHasAcceptedTerms(reporter)) {
        return sendApiError(res, 'NEXUS-GAME-011');
    }

    const targetUsername = resolveLedgerCommanderUsername(req.body?.targetUsername || '');
    if (!targetUsername) {
        return sendApiError(res, 'NEXUS-REPORT-001');
    }

    const targetCommander = db.get('commanders').find({ username: targetUsername }).value();
    if (!targetCommander || isHiddenRegistrationUsername(targetUsername)) {
        return sendApiError(res, 'NEXUS-REPORT-005');
    }

    const reports = getPlayerReportStore();
    const validation = validatePlayerReportSubmission({
        reports,
        reporterUsername,
        targetUsername,
        category: req.body?.category,
        details: req.body?.details,
        source: req.body?.source
    });

    if (!validation.ok) {
        if (validation.message) {
            return sendApiError(res, validation.errorCode || 'NEXUS-REPORT-001', { message: validation.message });
        }
        return sendApiError(res, validation.errorCode || 'NEXUS-REPORT-001');
    }

    const contextLabel = String(req.body?.contextLabel || '').trim().slice(0, REPORT_CONTEXT_MAX);
    const contextMeta = req.body?.contextMeta && typeof req.body.contextMeta === 'object'
        ? req.body.contextMeta
        : {};

    const report = buildPlayerReportRecord({
        reporterUsername: validation.reporterUsername,
        targetUsername: validation.targetUsername,
        category: validation.category,
        details: validation.details,
        source: validation.source,
        contextLabel,
        contextMeta,
        clientIp: resolveClientIp(req),
        userAgent: resolveClientUserAgent(req)
    });

    const screenshotPayload = parseScreenshotPayload(req.body?.screenshot);
    if (screenshotPayload) {
        const saved = savePlayerReportScreenshot(__dirname, report.id, screenshotPayload);
        if (!saved.ok) {
            if (saved.message) {
                return sendApiError(res, saved.errorCode || 'NEXUS-REPORT-006', { message: saved.message });
            }
            return sendApiError(res, saved.errorCode || 'NEXUS-REPORT-006');
        }
        report.screenshot = saved.screenshot;
    }

    reports.push(report);
    writePlayerReportStore(reports);
    deliverPlayerReportAdminNotice(report);

    res.status(201).json({
        status: 'ok',
        report: serializePlayerReportForClient(report)
    });
});

app.patch('/api/portal/community-chat/messages/:messageId', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!posterUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);

    const result = updateCommunityChatMessageInStore(store, req.params.messageId, posterUsername, req.body || {});

    if (result.errorCode || result.error) {
        return sendStoreError(res, result, { http: storeErrorHttpStatus(result, 400) });
    }

    store = writeCommunityChatStore(store);

    res.json({
        status: 'ok',
        message: result.entry,
        channelMessages: result.channelMessages,
        messages: flattenCommunityChatActiveMessages(store),
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.get('/api/portal/community-chat/archive', (req, res) => {
    const requester = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!isMailboxRecipientRosterAdmin(requester)) {
        return sendApiError(res, 'NEXUS-CHAT-009');
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);
    writeCommunityChatStore(store);

    const channel = String(req.query?.channel || '').trim();
    const limit = Math.min(5000, Math.max(1, parseInt(req.query?.limit, 10) || 500));
    let archive = store.archive.slice();

    if (channel && isCommunityChatChannelId(channel)) {
        archive = archive.filter((row) => row.channel === channel);
    }

    archive = archive.slice(-limit);

    res.json({
        status: 'ok',
        archive,
        count: archive.length,
        totalArchived: store.archive.length,
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.get('/api/portal/game-chat', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    let gameStore = readGameChatStore();
    gameStore = ensureGameChatSeedMessages(gameStore);
    writeGameChatStore(gameStore);

    let communityStore = readCommunityChatStore();
    communityStore = maybeRunScheduledCommunityChatPurge(communityStore);
    writeCommunityChatStore(communityStore);

    const filtered = filterGameChatMessagesForViewer(gameStore, commander);
    const since = String(req.query.since || '').trim();
    const communityMessages = flattenCommunityChatGeneralChannelMessages(communityStore);
    const syncPayload = buildGameChatSyncPayload(filtered, communityMessages, since);
    const viewerRestrictions = serializeCommunityChatRestrictionsForClient(username, communityStore);

    res.json({
        status: 'ok',
        messagesByChannel: syncPayload.messagesByChannel,
        communityMessages: syncPayload.communityMessages,
        hasAlliance: syncPayload.hasAlliance,
        gameNation: syncPayload.gameNation,
        allianceId: syncPayload.allianceId,
        syncMode: syncPayload.syncMode,
        viewerRestrictions,
        ui: getGameChatUiFromCommander(commander)
    });
});

app.post('/api/portal/game-chat/messages', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || req.body?.posterUsername || '');
    if (!posterUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username: posterUsername }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const requestedChannel = isGameChatChannelId(req.body?.channel) ? String(req.body.channel).trim() : 'global';

    let communityStore = readCommunityChatStore();
    communityStore = maybeRunScheduledCommunityChatPurge(communityStore);

    let store = readGameChatStore();
    store = ensureGameChatSeedMessages(store);

    let result;
    if (requestedChannel === 'global') {
        result = appendCommunityChatMessageToStore(communityStore, {
            channel: GAME_CHAT_GLOBAL_COMMUNITY_CHANNEL,
            sender: posterUsername,
            text: req.body?.text,
            posterUsername,
            ...buildChatSenderRankMeta(commander)
        });
    } else {
        result = appendGameChatMessageToStore(store, {
            ...req.body,
            posterUsername,
            sender: posterUsername
        }, commander);
    }

    if (result.errorCode || result.error) {
        return sendStoreError(res, result);
    }

    if (requestedChannel === 'global') {
        communityStore = writeCommunityChatStore(communityStore);
    } else {
        store = writeGameChatStore(store);
        communityStore = writeCommunityChatStore(communityStore);
    }

    const filtered = filterGameChatMessagesForViewer(store, commander);
    const communityMessages = flattenCommunityChatGeneralChannelMessages(communityStore);
    const viewerRestrictions = serializeCommunityChatRestrictionsForClient(posterUsername, communityStore);

    res.json({
        status: 'ok',
        message: result.entry,
        messagesByChannel: filtered.messagesByChannel,
        communityMessages,
        hasAlliance: filtered.hasAlliance,
        gameNation: filtered.gameNation,
        allianceId: filtered.allianceId,
        syncMode: 'full',
        viewerRestrictions,
        ui: getGameChatUiFromCommander(commander)
    });
});

app.get('/api/portal/age/nation-leadership', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.json({
        status: 'ok',
        ...buildNationLeadershipPayloadForCommander(commander)
    });
});

app.get('/api/portal/age/records', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.json({
        status: 'ok',
        ...buildAgeRecordsPayload({
            commanders: db.get('commanders').value() || [],
            nationRecordsMap: readNationAgeRecordsMap(),
            cityHolders: readAgeMovementStore().cityHolders,
            isHiddenUsername: isHiddenRegistrationUsername,
            resolveCommanderMapNationKey,
            readNationTreasuryForNation,
            readNationLeadershipForNation,
            resolveNationLeadershipDisplayName,
            resolveCatalogNationDisplayName
        })
    });
});

app.get('/api/portal/age/headquarters', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    res.set('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        workspace: buildHeadquartersWorkspaceForCommander(commander)
    });
});

app.post('/api/portal/age/scout-city', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCommanderMapNationKey(commander);
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const targetCityId = String(req.body?.cityId || '').trim();
    const movement = readCommanderMovementRecord(username, gameNation);
    const store = readAgeMovementStore();
    const border = validateBorderTarget(movement.catalogCityId, targetCityId);
    if (border?.errorCode) {
        return sendApiError(res, border.errorCode);
    }
    const relationship = classifyBorderRelationship(
        gameNation,
        border.targetCity,
        store.cityHolders,
        areNationsAllied
    );
    if (relationship === 'own') {
        return sendApiError(res, 'NEXUS-AGE-010');
    }

    const city = getCatalogCity(targetCityId);
    if (!city) {
        return sendApiError(res, 'NEXUS-AGE-003');
    }

    let nationState = readNationHeadquartersForNation(gameNation);
    const commanders = db.get('commanders').value() || [];
    const reports = buildSpyLogsFromCityScouts(
        commanders,
        targetCityId,
        city.name || '',
        username,
        resolveCommanderCatalogCityId
    );
    const appendResult = appendSpyLogs(nationState.spyLogs, reports);
    if (appendResult.errorCode === 'HQ_SPY_LOG_FULL' && !appendResult.added.length) {
        return sendApiError(res, appendResult.errorCode);
    }

    nationState = { ...nationState, spyLogs: appendResult.logs };
    const writeResult = writeNationHeadquartersForNation(gameNation, nationState);
    if (writeResult.errorCode) {
        return sendApiError(res, writeResult.errorCode);
    }

    res.json({
        status: 'ok',
        action: 'scout-city',
        cityId: targetCityId,
        cityName: city.name || '',
        addedCount: appendResult.added.length,
        partial: appendResult.errorCode === 'HQ_SPY_LOG_PARTIAL',
        workspace: buildHeadquartersWorkspaceForCommander(commander)
    });
});

app.get('/api/portal/age/watchtower', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const targetCityId = String(req.query?.cityId || '').trim();
    const snapshot = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    if (snapshot.errorCode) {
        return sendApiError(res, snapshot.errorCode);
    }

    res.set('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        workspace: snapshot.workspace
    });
});

app.post('/api/portal/age/watchtower/garrison-spy', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const targetCityId = String(req.body?.cityId || '').trim();
    const snapshot = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    if (snapshot.errorCode) {
        return sendApiError(res, snapshot.errorCode);
    }

    const trueIntel = buildTrueGarrisonIntel(snapshot.city, snapshot.commandersInCity);
    const fragment = buildGarrisonSpyFragment(trueIntel, {
        createdBy: username,
        cityId: targetCityId,
        cityName: snapshot.city?.name || ''
    });
    const appendResult = appendGarrisonSpy(snapshot.nationState.watchtower, fragment, username);
    if (appendResult.errorCode) {
        return sendApiError(res, appendResult.errorCode);
    }

    const nextNationState = {
        ...snapshot.nationState,
        watchtower: appendResult.watchtower
    };
    const writeResult = writeNationHeadquartersForNation(
        resolveCommanderMapNationKey(commander),
        nextNationState
    );
    if (writeResult.errorCode) {
        return sendApiError(res, writeResult.errorCode);
    }

    const refreshed = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    res.json({
        status: 'ok',
        action: 'watchtower-garrison-spy',
        fragment: appendResult.fragment,
        workspace: refreshed.workspace
    });
});

app.post('/api/portal/age/watchtower/compile-garrison', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const targetCityId = String(req.body?.cityId || '').trim();
    const snapshot = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    if (snapshot.errorCode) {
        return sendApiError(res, snapshot.errorCode);
    }

    const compileResult = compileGarrisonFragments(
        snapshot.nationState.watchtower,
        targetCityId,
        snapshot.city?.name || '',
        username
    );
    if (compileResult.errorCode) {
        return sendApiError(res, compileResult.errorCode);
    }

    const nextNationState = {
        ...snapshot.nationState,
        watchtower: compileResult.watchtower
    };
    const writeResult = writeNationHeadquartersForNation(
        resolveCommanderMapNationKey(commander),
        nextNationState
    );
    if (writeResult.errorCode) {
        return sendApiError(res, writeResult.errorCode);
    }

    const refreshed = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    res.json({
        status: 'ok',
        action: 'watchtower-compile-garrison',
        compiledReport: compileResult.report,
        workspace: refreshed.workspace
    });
});

app.post('/api/portal/age/watchtower/scout-player', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const targetCityId = String(req.body?.cityId || '').trim();
    const targetUsername = String(req.body?.targetUsername || '').trim();
    const snapshot = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    if (snapshot.errorCode) {
        return sendApiError(res, snapshot.errorCode);
    }

    if (targetUsername.toLowerCase() === username.toLowerCase()) {
        return sendApiError(res, 'NEXUS-AGE-035');
    }

    const targetCommander = snapshot.commandersInCity.find((row) => (
        String(row?.username || '').trim().toLowerCase() === targetUsername.toLowerCase()
    ));
    if (!targetCommander) {
        return sendApiError(res, 'NEXUS-AGE-034');
    }

    const currentGold = resolveCommanderAgeGold(commander);
    if (currentGold < SCOUT_GOLD_COST) {
        return sendApiError(res, 'NEXUS-AGE-033');
    }

    const scoutEstimate = buildPlayerScoutEstimate(targetCommander, targetCityId);
    const appendResult = appendPlayerScout(
        snapshot.nationState.watchtower,
        { ...scoutEstimate, createdBy: username },
        username
    );

    const nextGold = currentGold - SCOUT_GOLD_COST;
    db.get('commanders')
        .find({ username })
        .assign({ ageGold: nextGold })
        .write();

    const nextNationState = {
        ...snapshot.nationState,
        watchtower: appendResult.watchtower
    };
    const writeResult = writeNationHeadquartersForNation(
        resolveCommanderMapNationKey(commander),
        nextNationState
    );
    if (writeResult.errorCode) {
        return sendApiError(res, writeResult.errorCode);
    }

    commander = db.get('commanders').find({ username }).value();
    const refreshed = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    res.json({
        status: 'ok',
        action: 'watchtower-scout-player',
        goldSpent: SCOUT_GOLD_COST,
        ageGold: nextGold,
        scoutReport: appendResult.scoutEntry,
        workspace: refreshed.workspace,
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/watchtower/seize', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCommanderMapNationKey(commander);
    const targetCityId = String(req.body?.cityId || '').trim();
    const targetUsername = String(req.body?.targetUsername || '').trim();
    const snapshot = buildWatchtowerWorkspaceForCommander(commander, targetCityId);
    if (snapshot.errorCode) {
        return sendApiError(res, snapshot.errorCode);
    }

    if (snapshot.relationship !== 'hostile') {
        return sendApiError(res, 'NEXUS-AGE-035');
    }

    if (targetUsername.toLowerCase() === username.toLowerCase()) {
        return sendApiError(res, 'NEXUS-AGE-035');
    }

    const targetCommander = snapshot.commandersInCity.find((row) => (
        String(row?.username || '').trim().toLowerCase() === targetUsername.toLowerCase()
    ));
    if (!targetCommander) {
        return sendApiError(res, 'NEXUS-AGE-034');
    }

    const storageNation = resolveArmyGroupsStorageNation(commander);
    const armyGroupsState = storageNation
        ? readNationArmyGroupsForNation(storageNation)
        : null;
    if (armyGroupsState && findArmyGroupLedBy(armyGroupsState, username)) {
        return sendApiError(res, 'NEXUS-AGE-030');
    }

    const movement = readCommanderMovementRecord(username, gameNation);
    const spend = spendMovePoints(movement, 1);
    if (spend.errorCode) {
        return sendApiError(res, spend.errorCode);
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();
    let defender = db.get('commanders').find({ username: targetCommander.username }).value();
    ensureCommanderAgeRoster(defender);
    defender = db.get('commanders').find({ username: targetCommander.username }).value();

    const battleResult = executeBorderSeizeBattle(commander, defender);
    if (!battleResult.ok) {
        return sendApiError(res, battleResult.errorCode || 'NEXUS-AGE-017');
    }

    db.get('commanders')
        .find({ username })
        .assign({
            ageArmy: battleResult.attacker.ageArmy,
            rank: battleResult.attacker.rank,
            ageGuildXp: battleResult.attacker.ageGuildXp
        })
        .write();

    db.get('commanders')
        .find({ username: targetCommander.username })
        .assign({
            ageArmy: battleResult.defender.ageArmy,
            rank: battleResult.defender.rank,
            ageGuildXp: battleResult.defender.ageGuildXp
        })
        .write();

    writeCommanderMovementRecord(username, {
        catalogCityId: movement.catalogCityId,
        movePoints: spend.movePoints,
        lastMovePointRegenAt: spend.lastMovePointRegenAt
    });

    commander = db.get('commanders').find({ username }).value();
    const refreshed = buildWatchtowerWorkspaceForCommander(commander, targetCityId);

    res.json({
        status: 'ok',
        action: 'watchtower-seize',
        battle: {
            winner: battleResult.winner,
            attackerWon: battleResult.attackerWon,
            log: battleResult.log,
            defenderUsername: battleResult.defenderUsername
        },
        workspace: refreshed.workspace,
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.patch('/api/portal/age/headquarters', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const gameNation = access.gameNation;
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const body = req.body || {};
    let currentState = readNationHeadquartersForNation(gameNation);
    let currentLeadership = readNationLeadershipForNation(gameNation);
    const voteCandidatesForElection = listNationVoteCandidates(
        db.get('commanders').value() || [],
        gameNation,
        (entry) => getCouncilBoardStorageKey(resolveCouncilBoardNationKey(entry))
    );
    const electionSnapshot = reconcileHeadquartersElection(
        currentState,
        currentLeadership,
        voteCandidatesForElection
    );
    currentState = electionSnapshot.nationState;
    currentLeadership = electionSnapshot.leadership;
    let votingOpen = electionSnapshot.isOpen;
    if (electionSnapshot.shouldPersistLeadership && electionSnapshot.leadership) {
        writeNationLeadershipForNation(gameNation, electionSnapshot.leadership);
    }

    if (electionSnapshot.changed) {
        writeNationHeadquartersForNation(gameNation, currentState);
    }

    let nextState = { ...currentState };
    let responseExtra = {};

    if (body.confirmPlanning === true) {
        const confirmPatch = applyConfirmPlanningPatch(currentState, username, access);
        if (confirmPatch.errorCode) {
            return sendApiError(res, confirmPatch.errorCode);
        }
        nextState = { ...nextState, ...confirmPatch };
    } else if (body.editPlanning === true) {
        const editPatch = applyEditPlanningPatch(currentState, username, access);
        if (editPatch.errorCode) {
            return sendApiError(res, editPatch.errorCode);
        }
        nextState = { ...nextState, ...editPatch };
    } else if (body.clearPublishedPlan === true) {
        const clearPatch = applyClearPublishedPlanPatch(currentState, username, access);
        if (clearPatch.errorCode) {
            return sendApiError(res, clearPatch.errorCode);
        }
        nextState = { ...nextState, ...clearPatch };
    } else if (body.resetPlanning === true) {
        const resetPatch = applyResetPlanningPatch(currentState, username, access);
        if (resetPatch.errorCode) {
            return sendApiError(res, resetPatch.errorCode);
        }
        nextState = { ...nextState, ...resetPatch };
    } else if (body.planning && typeof body.planning === 'object') {
        const planningPatch = applyPlanningPatch(currentState, body.planning, username, access);
        if (planningPatch.errorCode) {
            return sendApiError(res, planningPatch.errorCode);
        }
        nextState = { ...nextState, ...planningPatch };
    }

    if (body.vote && typeof body.vote === 'object') {
        const voteCandidates = listNationVoteCandidates(
            db.get('commanders').value() || [],
            gameNation,
            (entry) => getCouncilBoardStorageKey(resolveCouncilBoardNationKey(entry))
        );
        const votePatch = applyVotePatch(nextState, body.vote, username, voteCandidates, {
            votingOpen
        });
        if (votePatch.errorCode) {
            return sendApiError(res, votePatch.errorCode);
        }
        nextState = { ...nextState, ...votePatch };

        const finalizeResult = tryFinalizeElectionFromVotes(nextState, currentLeadership, voteCandidates);
        if (finalizeResult) {
            nextState = finalizeResult.nationState;
            votingOpen = false;
            writeNationLeadershipForNation(gameNation, finalizeResult.leadership);
            currentLeadership = finalizeResult.leadership;
        } else {
            const postVoteElection = reconcileHeadquartersElection(
                nextState,
                currentLeadership,
                voteCandidates
            );
            nextState = postVoteElection.nationState;
            votingOpen = postVoteElection.isOpen;
            if (postVoteElection.shouldPersistLeadership && postVoteElection.leadership) {
                writeNationLeadershipForNation(gameNation, postVoteElection.leadership);
                currentLeadership = postVoteElection.leadership;
            }
        }
    }

    if (body.warDeclarationDraft && typeof body.warDeclarationDraft === 'object') {
        if (!access.fullAuthority || !access.leader) {
            return sendApiError(res, 'HQ_AUTHORITY_REQUIRED');
        }
        const targetNationId = resolveCatalogNationKey(body.warDeclarationDraft.targetNationId);
        if (!targetNationId) {
            return sendApiError(res, 'HQ_WAR_TARGET_REQUIRED');
        }
        const targetName = listWarTargetNations(gameNation).find((row) => row.id === targetNationId)?.name || targetNationId;
        responseExtra.warDeclarationDraft = {
            targetNationId,
            targetNationName: targetName,
            preparedAt: new Date().toISOString(),
            preparedBy: username
        };
    }

    if (body.warDeclarationRecord && typeof body.warDeclarationRecord === 'object') {
        if (!access.fullAuthority || !access.leader) {
            return sendApiError(res, 'HQ_AUTHORITY_REQUIRED');
        }
        const targetNationId = resolveCatalogNationKey(body.warDeclarationRecord.targetNationId);
        const targetName = listWarTargetNations(gameNation).find((row) => row.id === targetNationId)?.name
            || targetNationId;
        const recordPatch = recordRecognizedWarDeclaration(nextState, {
            targetNationId,
            targetNationName: targetName,
            declaredBy: username
        });
        if (recordPatch.errorCode) {
            return sendApiError(res, recordPatch.errorCode);
        }
        nextState = {
            ...nextState,
            warLedger: recordPatch.warLedger
        };
        responseExtra.warRecord = recordPatch.warRecord;
    }

    if (body.deleteSpyLogId) {
        const deleteResult = deleteSpyLog(nextState.spyLogs, body.deleteSpyLogId);
        if (deleteResult.errorCode) {
            return sendApiError(res, deleteResult.errorCode);
        }
        nextState = { ...nextState, spyLogs: deleteResult.logs };
    }

    if (body.forwardSpyLogId) {
        const forwardResult = forwardSpyLog(
            nextState.spyLogs,
            body.forwardSpyLogId,
            body.forwardSpyNationId || body.allyNationId
        );
        if (forwardResult.errorCode) {
            return sendApiError(res, forwardResult.errorCode);
        }
        nextState = { ...nextState, spyLogs: forwardResult.logs };
    }

    const writeResult = writeNationHeadquartersForNation(gameNation, nextState);
    if (writeResult.errorCode) {
        return sendApiError(res, writeResult.errorCode);
    }

    res.json({
        status: 'ok',
        workspace: buildHeadquartersWorkspaceForCommander(commander),
        ...responseExtra
    });
});

app.get('/api/portal/age/nation-plan', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const gameNation = access.gameNation;
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const nationState = readNationHeadquartersForNation(gameNation);
    res.set('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        gameNation,
        canClearPlan: Boolean(access.council),
        ...buildNationPlanPayload(nationState)
    });
});

app.get('/api/portal/age/dispatch-alert', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const gameNation = access.gameNation;
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const nationState = readNationHeadquartersForNation(gameNation);
    const alert = getActiveDispatchAlert(nationState);

    res.json({
        status: 'ok',
        gameNation,
        alert
    });
});

app.post('/api/portal/age/dispatch-alert', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const gameNation = access.gameNation;
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const alertType = String(req.body?.alertType || req.body?.type || '').trim();
    const currentState = readNationHeadquartersForNation(gameNation);
    const patch = applyDispatchAlertPatch(currentState, alertType, username, access);

    if (patch.errorCode) {
        if (patch.errorCode === 'HQ_DISPATCH_ACTIVE' && patch.activeAlert) {
            return res.status(409).json({
                status: 'error',
                code: 'NEXUS-HQ-012',
                alert: patch.activeAlert
            });
        }
        return sendApiError(res, patch.errorCode);
    }

    const nextState = {
        ...currentState,
        dispatchAlert: patch.dispatchAlert
    };
    const writeResult = writeNationHeadquartersForNation(gameNation, nextState);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    let systemMessage = null;
    if (patch.systemMessageText) {
        let store = readGameChatStore();
        const eventResult = appendGameChatNationSystemEventToStore(store, gameNation, patch.systemMessageText);
        if (!eventResult.errorCode && !eventResult.error) {
            store = writeGameChatStore(store);
            systemMessage = eventResult.entry;
        }
    }

    res.json({
        status: 'ok',
        gameNation,
        alert: patch.dispatchAlert,
        systemMessage
    });
});

app.get('/api/portal/age/headquarters-access', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const workspace = buildHeadquartersWorkspaceForCommander(commander);

    res.json({
        status: 'ok',
        gameNation: workspace.gameNation,
        access: workspace.access
    });
});

app.get('/api/portal/age/council-board', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCouncilBoardNationKey(commander);
    const board = readCouncilBoardForNation(gameNation);

    res.json({
        status: 'ok',
        gameNation,
        board,
        canEdit: canEditNationCouncilBoard(commander),
        statusCatalog: COUNCIL_BOARD_STATUS_IDS.map((id) => ({
            id,
            label: COUNCIL_BOARD_STATUS_LABELS[id]
        }))
    });
});

app.get('/api/portal/age/blessed-banners/schema', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(loadBlessedBannersSchema());
});

app.post('/api/portal/age/blessed-banners/validate-unlock', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const bannerId = String(req.body?.bannerId || '').trim();
    const nodeId = String(req.body?.nodeId || '').trim();
    if (bannerId !== 'emerald-barrier') {
        return res.status(400).json({ status: 'error', reason: 'Banner tree not active yet.' });
    }

    const schema = loadBlessedBannersSchema().banners[bannerId];
    const unlocked = normalizeUnlockedNodeIds(req.body?.unlockedNodeIds || []);
    const gate = canUnlockEmeraldNode(nodeId, unlocked, schema);
    const perkPoints = Math.max(0, Math.floor(Number(req.body?.perkPoints) || 0));

    res.set('Cache-Control', 'no-store');
    res.json({
        status: gate.ok ? 'ok' : 'error',
        reason: gate.reason || '',
        cost: gate.cost ?? 0,
        canAfford: gate.ok ? perkPoints >= (gate.cost ?? 0) : false
    });
});

app.patch('/api/portal/age/council-board', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    if (!canEditNationCouncilBoard(commander)) {
        return sendApiError(res, 'NEXUS-GAME-005');
    }

    const gameNation = resolveCouncilBoardNationKey(commander);
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const body = req.body || {};
    const current = readCouncilBoardForNation(gameNation);
    let nextStatusId = current.statusId;
    let previousStatusId = current.previousStatusId;

    if (body.revertFromEnemyBordering === true && current.statusId === 'enemy-bordering') {
        nextStatusId = isCouncilBoardStatusId(current.previousStatusId)
            ? current.previousStatusId
            : 'training-permitted';
        previousStatusId = null;
    } else if (isCouncilBoardStatusId(body.statusId)) {
        nextStatusId = body.statusId;
        if (nextStatusId === 'enemy-bordering' && current.statusId !== 'enemy-bordering') {
            previousStatusId = current.statusId;
        } else if (nextStatusId !== 'enemy-bordering') {
            previousStatusId = null;
        }
    }

    const nextBoard = normalizeCouncilBoardState({
        statusId: nextStatusId,
        previousStatusId,
        noticeText: 'noticeText' in body ? body.noticeText : current.noticeText,
        nextSfTime: 'nextSfTime' in body ? body.nextSfTime : current.nextSfTime,
        expectedPvpTime: 'expectedPvpTime' in body ? body.expectedPvpTime : current.expectedPvpTime,
        updatedAt: new Date().toISOString(),
        updatedBy: username
    });

    const writeResult = writeCouncilBoardForNation(gameNation, nextBoard);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    let systemMessage = null;
    if (writeResult.board.statusId !== current.statusId) {
        let store = readGameChatStore();
        const alertText = formatCouncilBoardStatusAlert(current.statusId, writeResult.board.statusId, username);
        const eventResult = appendGameChatNationSystemEventToStore(store, gameNation, alertText);
        if (!eventResult.errorCode && !eventResult.error) {
            store = writeGameChatStore(store);
            systemMessage = eventResult.entry;
        }
    }

    res.json({
        status: 'ok',
        gameNation,
        board: writeResult.board,
        statusChanged: writeResult.board.statusId !== current.statusId,
        systemMessage
    });
});

app.get('/api/portal/age/army-groups', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const state = readNationArmyGroupsForNation(gameNation);
    const payload = buildArmyGroupsApiPayload(state, access, username, {
        resolveMemberRank: resolveArmyGroupMemberRank,
        resolveMemberProfile: resolveArmyGroupMemberProfile
    });
    const memberGroup = payload.groups.find((group) => group.isMember);

    res.json({
        status: 'ok',
        gameNation,
        ...payload,
        deploymentGroupType: memberGroup?.type || ''
    });
});

function resolveArmyGroupMemberRank(username) {
    const commander = findCommanderByUsername(username);
    return buildCommanderRankMeta(commander).rank;
}

function resolveArmyGroupMemberProfile(username) {
    const commander = findCommanderByUsername(username);
    return buildCommanderRankMeta(commander);
}

function armyGroupRosterIncludesMember(memberUsernames, username) {
    const needle = String(username || '').trim().toLowerCase();
    if (!needle) return false;
    return (Array.isArray(memberUsernames) ? memberUsernames : []).some(
        (entry) => String(entry || '').trim().toLowerCase() === needle
    );
}

function respondArmyGroupsPayload(res, gameNation, commander, username, state, extra = {}) {
    const access = resolveHeadquartersAccessForCommander(commander);
    const payload = buildArmyGroupsApiPayload(state, access, username, {
        resolveMemberRank: resolveArmyGroupMemberRank,
        resolveMemberProfile: resolveArmyGroupMemberProfile
    });
    const memberGroup = payload.groups.find((group) => group.isMember);
    res.json({
        status: 'ok',
        gameNation,
        ...payload,
        deploymentGroupType: memberGroup?.type || '',
        ...extra
    });
}

function writeArmyGroupsNationState(res, gameNation, commander, username, state, extra = {}) {
    const writeResult = writeNationArmyGroupsForNation(gameNation, state);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }
    return respondArmyGroupsPayload(res, gameNation, commander, username, writeResult.state, extra);
}

function loadArmyGroupMemberCommanders(memberUsernames) {
    return (memberUsernames || []).map((entry) => {
        const memberUsername = String(entry || '').trim().toLowerCase();
        if (!memberUsername) return null;
        return db.get('commanders').find({ username: memberUsername }).value();
    }).filter(Boolean);
}

function applyArmyGroupCasualtyUpdates(casualtyUpdates) {
    (casualtyUpdates || []).forEach((entry) => {
        if (!entry?.username) return;
        persistCommanderGuildLedger(entry.username, { ageArmy: entry.ageArmy });
    });
}

function applyArmyGroupRelocationAssignments(assignments, nationKey, leaderMovePatch = null) {
    const relocations = [];
    Object.entries(assignments || {}).forEach(([memberUsername, catalogCityId]) => {
        const username = String(memberUsername || '').trim().toLowerCase();
        const cityId = String(catalogCityId || '').trim();
        if (!username || !cityId) return;

        const movement = readCommanderMovementRecord(username, nationKey);
        const nextRecord = {
            catalogCityId: cityId,
            movePoints: movement.movePoints,
            lastMovePointRegenAt: movement.lastMovePointRegenAt
        };
        if (leaderMovePatch && leaderMovePatch.username === username) {
            nextRecord.movePoints = leaderMovePatch.movePoints;
            nextRecord.lastMovePointRegenAt = leaderMovePatch.lastMovePointRegenAt;
        }
        writeCommanderMovementRecord(username, nextRecord);
        relocations.push({ username, catalogCityId: cityId });
    });
    return relocations;
}

function resolveArmyGroupsStorageNation(commander) {
    return getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
}

app.post('/api/portal/age/army-groups/create', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const current = readNationArmyGroupsForNation(gameNation);
    const leaderLimit = validateNotAlreadyLeadingGroup(current, username);
    if (leaderLimit) {
        return sendApiError(res, leaderLimit.errorCode, leaderLimit.message);
    }

    const validation = validateCreateArmyGroup({
        type: req.body?.type,
        name: req.body?.name,
        access,
        existingGroups: current.groups
    });
    if (validation.errorCode) {
        return sendApiError(res, validation.errorCode, validation.message);
    }

    const movement = readCommanderMovementRecord(username, gameNation);
    const cityId = String(
        movement.catalogCityId
        || req.body?.cityId
        || resolveDefaultCapitalCityId(gameNation)
        || ''
    ).trim();
    if (!cityId) {
        return sendApiError(res, 'NEXUS-GAME-014', 'A map city is required before creating an army group.');
    }

    const createResult = applyCreateArmyGroup(current, {
        type: validation.type,
        name: validation.name,
        leaderUsername: username,
        cityId
    });
    if (createResult.errorCode) {
        return sendApiError(res, createResult.errorCode);
    }

    const writeResult = writeNationArmyGroupsForNation(gameNation, createResult.state);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    respondArmyGroupsPayload(res, gameNation, commander, username, writeResult.state, {
        group: createResult.group
    });
});

app.post('/api/portal/age/army-groups/join', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const groupId = String(req.body?.groupId || '').trim();
    if (!groupId) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const current = readNationArmyGroupsForNation(gameNation);
    const leaderLimit = validateNotAlreadyLeadingGroup(current, username);
    if (leaderLimit) {
        return sendApiError(res, leaderLimit.errorCode, leaderLimit.message);
    }

    const joinResult = applyJoinArmyGroup(current, { groupId, username });
    if (joinResult.errorCode) {
        return sendApiError(res, joinResult.errorCode, joinResult.message);
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const writeResult = writeNationArmyGroupsForNation(gameNation, joinResult.state);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    respondArmyGroupsPayload(res, gameNation, commander, username, writeResult.state, {
        group: joinResult.group,
        alreadyMember: Boolean(joinResult.alreadyMember)
    });
});

app.post('/api/portal/age/army-groups/sf-lead-candidate', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const current = readNationArmyGroupsForNation(gameNation);
    const toggleResult = applyToggleSfLeadCandidate(current, username);
    if (toggleResult.errorCode) {
        return sendApiError(res, toggleResult.errorCode);
    }

    const access = resolveHeadquartersAccessForCommander(commander);
    const writeResult = writeNationArmyGroupsForNation(gameNation, toggleResult.state);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    respondArmyGroupsPayload(res, gameNation, commander, username, writeResult.state, {
        sfLeadCandidate: toggleResult.listed
    });
});

app.post('/api/portal/age/army-groups/sonar', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const movement = readCommanderMovementRecord(username, gameNation);
    const cityId = String(movement.catalogCityId || req.body?.cityId || '').trim();
    if (!cityId) {
        return sendApiError(res, 'NEXUS-GAME-014', 'A map city is required before signaling for rescue.');
    }

    const current = readNationArmyGroupsForNation(gameNation);
    const sonarResult = applyStartSonar(current, { username, cityId });
    if (sonarResult.errorCode) {
        return sendApiError(res, sonarResult.errorCode);
    }

    const prunedState = {
        ...sonarResult.state,
        sonarSessions: pruneSonarSessions(sonarResult.state.sonarSessions)
    };
    const writeResult = writeNationArmyGroupsForNation(gameNation, prunedState);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    respondArmyGroupsPayload(res, gameNation, commander, username, writeResult.state, {
        session: sonarResult.session || null,
        sonarActive: Boolean(sonarResult.session),
        deactivated: Boolean(sonarResult.deactivated),
        activated: Boolean(sonarResult.activated)
    });
});

app.post('/api/portal/age/army-groups/rename', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const groupId = String(req.body?.groupId || '').trim();
    if (!groupId) return sendApiError(res, 'NEXUS-GEN-003');

    const current = readNationArmyGroupsForNation(gameNation);
    const renameResult = applyRenameArmyGroup(current, {
        groupId,
        username,
        name: req.body?.name
    });
    if (renameResult.errorCode) {
        return sendApiError(res, renameResult.errorCode, renameResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, renameResult.state, {
        group: renameResult.group
    });
});

app.post('/api/portal/age/army-groups/set-type', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const groupId = String(req.body?.groupId || '').trim();
    if (!groupId) return sendApiError(res, 'NEXUS-GEN-003');

    const access = resolveHeadquartersAccessForCommander(commander);
    const current = readNationArmyGroupsForNation(gameNation);
    const typeResult = applySetArmyGroupType(current, {
        groupId,
        username,
        type: req.body?.type,
        access
    });
    if (typeResult.errorCode) {
        return sendApiError(res, typeResult.errorCode, typeResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, typeResult.state, {
        group: typeResult.group,
        unchanged: Boolean(typeResult.unchanged)
    });
});

app.post('/api/portal/age/army-groups/dismiss', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const groupId = String(req.body?.groupId || '').trim();
    if (!groupId) return sendApiError(res, 'NEXUS-GEN-003');

    const current = readNationArmyGroupsForNation(gameNation);
    const dismissResult = applyDismissArmyGroup(current, { groupId, username });
    if (dismissResult.errorCode) {
        return sendApiError(res, dismissResult.errorCode, dismissResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, dismissResult.state, {
        dismissedGroupId: dismissResult.dismissedGroupId
    });
});

app.post('/api/portal/age/assault-casualty-estimate', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const mapNation = resolveCommanderMapNationKey(commander);
    if (!mapNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const targetCityId = String(req.body?.targetCityId || '').trim();
    const movement = readCommanderMovementRecord(username, mapNation);
    const store = readAgeMovementStore();
    const validation = validateAssault(
        mapNation,
        movement.catalogCityId,
        targetCityId,
        store.cityHolders,
        areNationsAllied
    );
    if (validation.errorCode) {
        return sendApiError(res, validation.errorCode);
    }

    const storageNation = resolveArmyGroupsStorageNation(commander);
    const groupId = String(req.body?.groupId || '').trim();
    let memberCommanders = [commander];

    if (groupId && storageNation) {
        const groupsState = readNationArmyGroupsForNation(storageNation);
        const lookup = groupsState.groups.find((group) => group.id === groupId);
        if (!lookup) {
            return sendApiError(res, 'NEXUS-GAME-013');
        }
        if (String(lookup.leaderUsername || '').trim().toLowerCase() !== username) {
            return sendApiError(res, 'NEXUS-AGE-029');
        }
        memberCommanders = loadArmyGroupMemberCommanders(lookup.memberUsernames);
        if (!memberCommanders.length) {
            memberCommanders = [commander];
        }
    }

    const playersInCity = normalizePlayersInCityCount(req.body?.playersInCity);
    const allCommanders = db.get('commanders').value() || [];
    const estimate = buildArmyGroupAssaultCasualtyEstimate({
        memberCommanders,
        targetCity: validation.targetCity,
        nationKey: mapNation,
        playersInCity,
        allCommanders,
        isAlliedFn: areNationsAllied,
        resolveCommanderCityId: resolveCommanderCatalogCityId
    });

    res.set('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        targetCityId,
        targetCityName: validation.targetCity?.name || '',
        playersInCity,
        hasEnemyPlayers: estimate.context.hasEnemyPlayers,
        enemyCommanders: estimate.enemyCommanders,
        attacker: {
            hp: estimate.context.attacker.hp,
            units: estimate.context.attacker.units,
            commanders: estimate.context.attacker.commanders
        },
        defender: {
            hp: estimate.context.defender.hp,
            units: estimate.context.defender.units,
            garrisonUnits: estimate.context.defender.garrisonUnits,
            enemyCommanders: estimate.context.defender.enemyCommanders,
            playersInCity: estimate.context.defender.playersInCity
        },
        casualtyRisk: estimate.risk
    });
});

app.post('/api/portal/age/army-groups/attack', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const storageNation = resolveArmyGroupsStorageNation(commander);
    if (!storageNation) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const mapNation = resolveCommanderMapNationKey(commander);
    const groupId = String(req.body?.groupId || '').trim();
    const targetCityId = String(req.body?.targetCityId || '').trim();
    if (!groupId || !targetCityId) {
        return sendApiError(res, 'NEXUS-GEN-003');
    }

    const current = readNationArmyGroupsForNation(storageNation);
    const lookup = current.groups.find((group) => group.id === groupId);
    if (!lookup) {
        return sendApiError(res, 'NEXUS-GAME-013');
    }

    const movement = readCommanderMovementRecord(username, mapNation);
    const store = readAgeMovementStore();
    const playersInCity = normalizePlayersInCityCount(req.body?.playersInCity);
    const memberCommanders = loadArmyGroupMemberCommanders(lookup.memberUsernames);

    const assaultValidation = validateAssault(
        mapNation,
        movement.catalogCityId,
        targetCityId,
        store.cityHolders,
        areNationsAllied
    );
    if (assaultValidation.errorCode) {
        return sendApiError(res, assaultValidation.errorCode);
    }

    const spend = spendMovePoints(movement, assaultValidation.connection?.movePointCost || 1);
    if (spend.errorCode) {
        return sendApiError(res, spend.errorCode);
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const allCommanders = db.get('commanders').value() || [];
    const attackResult = prepareArmyGroupAttack({
        state: current,
        groupId,
        leaderUsername: username,
        leaderCommander: commander,
        memberCommanders,
        nationKey: mapNation,
        originCityId: movement.catalogCityId,
        targetCityId,
        cityHolders: store.cityHolders,
        isAlliedFn: areNationsAllied,
        playersInCity,
        allCommanders,
        resolveCommanderCityId: resolveCommanderCatalogCityId
    });
    if (attackResult.errorCode) {
        return sendApiError(res, attackResult.errorCode, attackResult.message);
    }

    const battleResult = attackResult.battleResult;
    persistCommanderGuildLedger(username, {
        rank: battleResult.rank,
        ageGuildXp: battleResult.ageGuildXp,
        ageProvisions: Math.max(
            0,
            Math.floor(Number(resolveCommanderAgeProvisions(commander)) || 0) + (battleResult.provisionsGranted || 0)
        )
    });

    applyArmyGroupCasualtyUpdates(attackResult.casualtyUpdates);

    let captureReward = null;
    const targetCity = attackResult.targetCity;
    const previousHolder = resolveCityHolder(targetCity, store.cityHolders);

    if (attackResult.assaultVictory) {
        recordCityCapture(
            store,
            targetCityId,
            getCouncilBoardStorageKey(mapNation),
            previousHolder
        );
        writeAgeMovementStore(store);

        captureReward = awardNationTreasuryForCaptureEvent(
            mapNation,
            'city-capture',
            playersInCity,
            {
                cityId: targetCityId,
                cityName: targetCity.name,
                awardedBy: username
            }
        );
    }

    const leaderMovePatch = {
        username,
        movePoints: spend.movePoints,
        lastMovePointRegenAt: spend.lastMovePointRegenAt
    };
    const relocations = applyArmyGroupRelocationAssignments(
        attackResult.relocationPlan.assignments,
        mapNation,
        leaderMovePatch
    );

    const writeResult = writeNationArmyGroupsForNation(storageNation, attackResult.normalizedState);
    if (writeResult.errorCode) {
        return sendStoreError(res, writeResult);
    }

    commander = db.get('commanders').find({ username }).value();

    respondArmyGroupsPayload(res, storageNation, commander, username, writeResult.state, {
        action: 'army-group-attack',
        assaultVictory: attackResult.assaultVictory,
        winner: battleResult.winner,
        endReason: battleResult.endReason,
        dismissedGroupId: attackResult.dismissedGroupId,
        groupType: attackResult.groupType,
        relocationMode: attackResult.relocationPlan.mode,
        evacuationCityId: attackResult.relocationPlan.evacuationCityId || null,
        relocations,
        roundsPlayed: battleResult.roundsPlayed,
        infantryRounds: battleResult.infantryRounds,
        log: battleResult.log,
        xpGain: battleResult.xpGain,
        xpBreakdown: battleResult.xpBreakdown || null,
        rank: battleResult.rank,
        rankPromoted: battleResult.rankPromoted,
        rankPromotions: battleResult.rankPromotions,
        provisionsGranted: battleResult.provisionsGranted,
        ageGuildXp: battleResult.ageGuildXp,
        ageGuildXpRequired: battleResult.ageGuildXpRequired,
        ageGuildXpProgress: battleResult.ageGuildXpProgress,
        targetCityId,
        previousHolderNationId: previousHolder,
        newHolderNationId: attackResult.assaultVictory
            ? getCouncilBoardStorageKey(mapNation)
            : previousHolder,
        cityHolders: store.cityHolders,
        cityLosers: store.cityLosers,
        captureReward: captureReward && !captureReward.errorCode ? {
            grantedRsd: captureReward.grantedRsd,
            treasury: captureReward.treasury
        } : null,
        rules: getMovePointRules(),
        catalogCityId: relocations.find((entry) => entry.username === username)?.catalogCityId
            || movement.catalogCityId,
        movePoints: spend.movePoints,
        movePointsMax: getMovePointRules().movePointsMax,
        lastMovePointRegenAt: spend.lastMovePointRegenAt,
        casualtyRisk: attackResult.casualtyRisk || null,
        casualtyContext: attackResult.casualtyContext || null,
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/army-groups/kick', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const groupId = String(req.body?.groupId || '').trim();
    const targetUsername = String(req.body?.targetUsername || '').trim();
    if (!groupId || !targetUsername) return sendApiError(res, 'NEXUS-GEN-003');

    const current = readNationArmyGroupsForNation(gameNation);
    const kickResult = applyKickArmyGroupMember(current, { groupId, username, targetUsername });
    if (kickResult.errorCode) {
        return sendApiError(res, kickResult.errorCode, kickResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, kickResult.state, {
        group: kickResult.group,
        removedUsername: kickResult.removedUsername
    });
});

app.post('/api/portal/age/army-groups/merge-into', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const sourceGroupId = String(req.body?.sourceGroupId || req.body?.groupId || '').trim();
    const targetGroupId = String(req.body?.targetGroupId || '').trim();
    if (!sourceGroupId || !targetGroupId) return sendApiError(res, 'NEXUS-GEN-003');

    const current = readNationArmyGroupsForNation(gameNation);
    const mergeResult = applyMergeArmyGroupInto(current, {
        sourceGroupId,
        targetGroupId,
        username,
        resolveRank: resolveArmyGroupMemberRank
    });
    if (mergeResult.errorCode) {
        return sendApiError(res, mergeResult.errorCode, mergeResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, mergeResult.state, {
        movedCount: mergeResult.movedCount,
        sourceRemoved: mergeResult.sourceRemoved
    });
});

app.post('/api/portal/age/army-groups/escort', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const sourceGroupId = String(req.body?.sourceGroupId || '').trim();
    const targetGroupId = String(req.body?.targetGroupId || '').trim();
    if (!sourceGroupId || !targetGroupId) return sendApiError(res, 'NEXUS-GEN-003');

    const access = resolveHeadquartersAccessForCommander(commander);
    const current = readNationArmyGroupsForNation(gameNation);
    const escortResult = applyEscortMembersToCommandPost(current, {
        sourceGroupId,
        targetGroupId,
        memberUsernames: req.body?.memberUsernames,
        username,
        access
    });
    if (escortResult.errorCode) {
        return sendApiError(res, escortResult.errorCode, escortResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, escortResult.state, {
        escortedCount: escortResult.escortedCount,
        sourceRemoved: escortResult.sourceRemoved
    });
});

app.post('/api/portal/age/army-groups/absorb', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) return sendApiError(res, 'NEXUS-GEN-002');

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const sourceGroupId = String(req.body?.sourceGroupId || '').trim();
    const targetGroupId = String(req.body?.targetGroupId || '').trim();
    if (!sourceGroupId || !targetGroupId) return sendApiError(res, 'NEXUS-GEN-003');

    const access = resolveHeadquartersAccessForCommander(commander);
    const current = readNationArmyGroupsForNation(gameNation);
    const absorbResult = applyAbsorbArmyGroupInto(current, {
        sourceGroupId,
        targetGroupId,
        username,
        access,
        resolveRank: resolveArmyGroupMemberRank
    });
    if (absorbResult.errorCode) {
        return sendApiError(res, absorbResult.errorCode, absorbResult.message);
    }

    writeArmyGroupsNationState(res, gameNation, commander, username, absorbResult.state, {
        absorbedCount: absorbResult.absorbedCount,
        sourceRemoved: absorbResult.sourceRemoved
    });
});

app.get('/api/portal/age/army-groups/member-army', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    const targetUsername = resolveLedgerCommanderUsername(req.query?.targetUsername || '');
    if (!username || !targetUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    if (username.toLowerCase() === targetUsername.toLowerCase()) {
        return sendApiError(
            res,
            'NEXUS-GEN-005',
            'View your own army from the Barracks or Garrison page.'
        );
    }

    const commander = findCommanderByUsername(username);
    if (!commander) return sendApiError(res, 'NEXUS-GEN-004');

    const gameNation = getCouncilBoardStorageKey(resolveCouncilBoardNationKey(commander));
    if (!gameNation) return sendApiError(res, 'GAME_NATION_REQUIRED');

    const targetCommander = findCommanderByUsername(targetUsername);
    if (!targetCommander) return sendApiError(res, 'NEXUS-GEN-004');

    const state = readNationArmyGroupsForNation(gameNation);
    const normalized = normalizeNationArmyGroupsState(state);
    const access = resolveHeadquartersAccessForCommander(commander);
    const nationCommand = Boolean(access?.leader || access?.viceLeader);
    const sharedRoster = normalized.groups.some(
        (group) => armyGroupRosterIncludesMember(group.memberUsernames, username)
            && armyGroupRosterIncludesMember(group.memberUsernames, targetUsername)
    );

    if (!sharedRoster && !nationCommand) {
        return sendApiError(res, 'NEXUS-GEN-005', 'You cannot view that commander\'s army.');
    }

    ensureCommanderAgeRoster(targetCommander);
    const refreshed = findCommanderByUsername(targetUsername) || targetCommander;
    const roster = buildAgeRosterHudPayload(refreshed);
    const rankMeta = buildCommanderRankMeta(refreshed);

    res.json({
        status: 'ok',
        username: String(refreshed.username || targetUsername).trim(),
        rank: rankMeta.rank,
        path: rankMeta.path,
        rankTitleGender: rankMeta.rankTitleGender,
        rankDisplayTitle: getCommanderRankDisplayTitle(rankMeta.rank, rankMeta.path, rankMeta.rankTitleGender) || null,
        ...roster
    });
});

app.get('/api/portal/age/nation-treasury', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCouncilBoardNationKey(commander);
    const treasury = readNationTreasuryForNation(gameNation);
    const rewardRules = getNationTreasuryRewardRules();

    res.json({
        status: 'ok',
        gameNation,
        rsd: treasury.rsd,
        currency: rewardRules.currency,
        currencyLabel: rewardRules.currencyLabel,
        updatedAt: treasury.updatedAt,
        rewardRules
    });
});

app.post('/api/portal/age/nation-treasury/capture-reward', (req, res) => {
    const requester = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!requester || !isMailboxRecipientRosterAdmin(requester)) {
        return sendApiError(res, 'NEXUS-GAME-005');
    }

    const nationKey = String(req.body?.nationKey || req.body?.gameNation || '').trim();
    if (!nationKey) {
        return sendApiError(res, 'GAME_NATION_REQUIRED');
    }

    const eventType = normalizeNationTreasuryEventType(req.body?.eventType);
    if (!eventType) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const result = awardNationTreasuryForCaptureEvent(
        nationKey,
        eventType,
        req.body?.playersInCity,
        {
            cityId: req.body?.cityId,
            cityName: req.body?.cityName,
            awardedBy: requester
        }
    );

    if (result.errorCode) {
        return sendStoreError(res, result);
    }

    res.json({
        status: 'ok',
        gameNation: nationKey,
        grantedRsd: result.grantedRsd,
        treasury: result.treasury,
        meta: result.meta,
        rewardRules: getNationTreasuryRewardRules()
    });
});

app.get('/api/portal/game/onboarding-config', (req, res) => {
    res.json({
        status: 'ok',
        config: getOnboardingOpenConfig()
    });
});

app.get('/api/portal/game/onboarding-class', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const path = normalizeClassPathCode(commander.path);
    const perk1Branch = normalizeClassPerk1Branch(
        commander?.ageClassPerkChoices?.perk1 || commander?.ageClassPerk1Branch
    );

    res.json({
        status: 'ok',
        path: path || null,
        classId: path ? resolveClassIdFromPath(path) : null,
        perk1Branch,
        ageClassPerkChoices: perk1Branch ? { perk1: perk1Branch } : null,
        locked: commanderHasLockedClassChoice(commander),
        ageClassConfirmedAt: commander.ageClassConfirmedAt || null
    });
});

app.post('/api/portal/game/onboarding-class', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const termsGate = assertCommanderAcceptedTermsForJoinAge(commander, req);
    if (!termsGate.ok) {
        return res.status(403).json({
            status: 'error',
            code: termsGate.code,
            message: termsGate.message,
            requiresTermsAcceptance: true
        });
    }

    const allowClassReselect = isLiveServerPort5500Request(req)
        || (!isProduction && isLocalDevHostRequest(req));
    const result = buildClassOnboardingPatch(req.body || {}, commander, { allowClassReselect });
    if (!result.ok) {
        return sendApiError(res, result.errorCode);
    }

    if (Object.keys(result.patch).length) {
        db.get('commanders')
            .find({ username })
            .assign(result.patch)
            .write();
    }

    const updated = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        path: result.path,
        classId: result.classId,
        perk1Branch: result.perk1Branch,
        alreadySaved: result.alreadySaved,
        classReselected: result.classReselected === true,
        ageClassPerkChoices: updated.ageClassPerkChoices || { perk1: result.perk1Branch },
        dossier: serializeCommanderDossierForClient(updated)
    });
});

app.post('/api/portal/game/onboarding-nation', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const termsGate = assertCommanderAcceptedTermsForJoinAge(commander, req);
    if (!termsGate.ok) {
        return res.status(403).json({
            status: 'error',
            code: termsGate.code,
            message: termsGate.message,
            requiresTermsAcceptance: true
        });
    }

    const regionId = String(req.body?.regionId || '').trim();
    if (!isOnboardingRegionAllowed(regionId)) {
        return sendApiError(res, 'NEXUS-GAME-013');
    }

    const nationId = resolveOnboardingNationId(req.body?.nationId);
    if (!nationId) {
        return sendApiError(res, 'NEXUS-GAME-012');
    }

    const existingNation = resolveCatalogNationKey(commander.gameNation);
    if (existingNation && existingNation !== nationId) {
        return sendApiError(res, 'NEXUS-GAME-014');
    }

    if (!existingNation) {
        db.get('commanders')
            .find({ username })
            .assign({
                gameNation: nationId,
                onboardingRegionId: regionId,
                gameNationSetAt: new Date().toISOString()
            })
            .write();
    }

    const updated = db.get('commanders').find({ username }).value();
    ensureCommanderAgeRoster(updated);
    const rosterCommander = db.get('commanders').find({ username }).value();
    const movementNation = resolveCommanderMapNationKey(rosterCommander);
    const defaultMovement = getDefaultCommanderMovementRecord(movementNation);
    const existingMovement = readCommanderMovementRecord(username, movementNation);
    if (!existingMovement.catalogCityId) {
        writeCommanderMovementRecord(username, defaultMovement);
    }

    const dossier = serializeCommanderDossierForClient(updated);

    res.json({
        status: 'ok',
        gameNation: nationId,
        regionId,
        dossier,
        movement: buildAgeMovementStatePayload(username, rosterCommander)
    });
});

app.get('/api/portal/age/movement-state', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    const refreshedCommander = db.get('commanders').find({ username }).value();

    const mapNation = resolveCommanderMapNationKey(refreshedCommander);
    const councilNation = resolveCouncilBoardNationKey(refreshedCommander);
    const movement = readCommanderMovementRecord(username, mapNation || councilNation);
    writeCommanderMovementRecord(username, movement);

    res.json({
        status: 'ok',
        ...buildAgeMovementStatePayload(username, refreshedCommander)
    });
});

app.get('/api/portal/age/nation-players', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const requestedNation = String(req.query?.nationId || '').trim();
    const nationId = requestedNation || resolveCommanderMapNationKey(commander);
    if (!resolveCatalogNationKey(nationId)) {
        return sendApiError(res, 'NEXUS-AGE-008');
    }

    res.json({
        status: 'ok',
        ...buildAgeNationPlayersPayload(nationId, username)
    });
});

app.get('/api/portal/age/city-players', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const catalogCityId = String(req.query?.catalogCityId || '').trim();

    res.json({
        status: 'ok',
        ...buildAgeCityPlayersPayload(catalogCityId, username)
    });
});

app.post('/api/portal/age/recruit-units', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const unitId = String(req.body?.unitId || '').trim();
    const quantity = req.body?.quantity;
    const result = executeAgeUnitRecruitmentWithBalanceAudit({ commander, unitId, quantity });

    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-012');
    }

    db.get('commanders')
        .find({ username })
        .assign({
            ageGold: result.ageGold,
            ageProvisions: result.ageProvisions,
            ageArmy: result.ageArmy,
            ageRecruitedAt: new Date().toISOString()
        })
        .write();

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'recruit-units',
        unitId: result.unitId,
        quantity: result.quantity,
        unitCost: result.unitCost,
        goldSpent: result.goldSpent,
        provisionsSpent: result.provisionsSpent,
        upcPerUnit: result.upcPerUnit,
        ageGold: result.ageGold,
        ageProvisions: result.ageProvisions,
        ageArmy: result.ageArmy,
        unitsTotal: result.unitsTotal,
        unitsUninjured: result.unitsUninjured,
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/admin/reset-age-rosters', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }
    if (!isAgeLedgerAdminUsername(username)) {
        return sendApiError(res, 'NEXUS-AGE-018');
    }

    const commanders = db.get('commanders').value() || [];
    const resetCount = resetAllCommanderAgeArmies(commanders);

    commanders.forEach((commander, index) => {
        if (!isAgeLedgerAdminUsername(commander?.username)) return;
        commanders[index] = {
            ...commander,
            ...buildCommanderRankResetLedgerPatch(),
            ageGearSlots: null,
            ageGearLocked: false,
            ageGuildMerch: [],
            ageGuildPerks: null,
            ageGuildBonuses: null,
            ageResetUsage: {}
        };
    });

    db.set('commanders', commanders).write();
    db.get('portal').assign({ ageRosterResetAt: new Date().toISOString() }).write();

    const adminCommander = commanders.find((entry) => isAgeLedgerAdminUsername(entry?.username));
    const roster = buildAgeRosterHudPayload(adminCommander);

    res.json({
        status: 'ok',
        action: 'reset-age-rosters',
        resetCount,
        rank: adminCommander ? Math.max(1, Math.floor(Number(adminCommander.rank) || 1)) : 1,
        ageGuildXp: adminCommander ? Math.max(0, Math.floor(Number(adminCommander.ageGuildXp) || 0)) : 0,
        ageGold: adminCommander ? resolveCommanderAgeGold(adminCommander) : null,
        ageProvisions: adminCommander ? resolveCommanderAgeProvisions(adminCommander) : null,
        ageArmy: [],
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured
    });
});

app.post('/api/portal/age/admin/set-provisions', (req, res) => {
    const actingUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!actingUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }
    if (!isAgeLedgerAdminUsername(actingUsername)) {
        return sendApiError(res, 'NEXUS-AGE-018');
    }

    const targetUsername = resolveLedgerCommanderUsername(
        req.body?.targetUsername || req.body?.commanderUsername || actingUsername
    );
    if (!targetUsername) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    let commander = db.get('commanders').find({ username: targetUsername }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const nextProvisions = Math.floor(Number(req.body?.ageProvisions));
    if (!Number.isFinite(nextProvisions) || nextProvisions < 0) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const previousProvisions = resolveCommanderAgeProvisions(commander);
    persistCommanderGuildLedger(targetUsername, { ageProvisions: nextProvisions });
    commander = db.get('commanders').find({ username: targetUsername }).value();

    res.json({
        status: 'ok',
        action: 'set-provisions',
        username: targetUsername,
        previousProvisions,
        ageProvisions: resolveCommanderAgeProvisions(commander),
        ...buildAgeMovementStatePayload(targetUsername, commander)
    });
});

app.post('/api/portal/age/admin/reset-commander-progress', (req, res) => {
    const actingUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!actingUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }
    if (!isAgeLedgerAdminUsername(actingUsername)) {
        return sendApiError(res, 'NEXUS-AGE-018');
    }

    const targetUsername = resolveLedgerCommanderUsername(
        req.body?.targetUsername || req.body?.commanderUsername || actingUsername
    );
    if (!targetUsername) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    let commander = db.get('commanders').find({ username: targetUsername }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    db.get('commanders')
        .find({ username: targetUsername })
        .assign({
            ...buildCommanderRankResetLedgerPatch(),
            ageGearSlots: null,
            ageGearLocked: false,
            ageGuildMerch: [],
            ageGuildPerks: null,
            ageGuildBonuses: null,
            army: [],
            dossierUpdatedAt: new Date().toISOString()
        })
        .write();

    commander = db.get('commanders').find({ username: targetUsername }).value();
    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username: targetUsername }).value();
    const roster = buildAgeRosterHudPayload(commander);

    res.json({
        status: 'ok',
        action: 'reset-commander-progress',
        username: targetUsername,
        rank: Math.max(1, Math.floor(Number(commander.rank) || 1)),
        ageGuildXp: Math.max(0, Math.floor(Number(commander.ageGuildXp) || 0)),
        ageGold: resolveCommanderAgeGold(commander),
        ageProvisions: resolveCommanderAgeProvisions(commander),
        ageArmy: roster.ageArmy,
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(targetUsername, commander)
    });
});

function persistCommanderGuildLedger(username, patch) {
    if (!username || !patch || typeof patch !== 'object') return;
    const assign = {};
    if (patch.ageArmy !== undefined) assign.ageArmy = patch.ageArmy;
    if (patch.ageGold !== undefined) assign.ageGold = patch.ageGold;
    if (patch.ageProvisions !== undefined) assign.ageProvisions = patch.ageProvisions;
    if (patch.rank !== undefined) assign.rank = patch.rank;
    if (patch.ageGuildXp !== undefined) assign.ageGuildXp = patch.ageGuildXp;
    if (patch.ageGuildMerch !== undefined) assign.ageGuildMerch = patch.ageGuildMerch;
    if (patch.ageGuildAcceptedBountyId !== undefined) {
        assign.ageGuildAcceptedBountyId = patch.ageGuildAcceptedBountyId || null;
    }
    if (Object.keys(assign).length) {
        db.get('commanders').find({ username }).assign(assign).write();
    }
}

function readGuildBountyState() {
    return normalizeBountyState(db.get('portal.ageGuildBounties').value());
}

function writeGuildBountyState(state) {
    db.set('portal.ageGuildBounties', normalizeBountyState(state)).write();
}

function buildGuildBountyContext(referenceNation = '') {
    return {
        referenceNation: String(referenceNation || '').trim().toLowerCase(),
        isAllied: areNationsAllied
    };
}

function deliverGuildBountyAlert(targetUsername, hunterUsername) {
    const owner = resolveLedgerCommanderUsername(targetUsername);
    if (!owner) return;

    const messages = getMailboxMessageStore();
    messages.push({
        id: createMailboxRecordId(),
        channel: 'system',
        systemMessageKey: 'age_guild_bounty_alert_v1',
        from: "Adventurer's Guild",
        to: owner,
        topic: 'Bounty placed on your head',
        body: `<p>A guild bounty contract is active on your commander.</p><p>Hunter interest may increase while the mark remains. Evade defeat for <strong>${BOUNTY_REWARDS.targetEvadeGold.toLocaleString()} gold</strong> and <strong>${BOUNTY_REWARDS.targetEvadeNationRsd.toLocaleString()} RSD</strong> for your nation if the contract expires.</p>${hunterUsername ? `<p>Latest hunter: ${String(hunterUsername).replace(/[<>&"]/g, '')}</p>` : ''}`,
        bodyFormat: 'html',
        read: false,
        sentAt: new Date().toISOString()
    });
    writeMailboxMessageStore(messages);
}

function grantCommanderChronicleXp(username, amount, activityKey = 'pvpAttacks') {
    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return null;

    const xpState = normalizeCommanderChronicleXp(commander.chronicleXp);
    const grant = Math.max(0, Math.floor(Number(amount) || 0));
    if (!grant) return xpState;

    xpState.totalXp += grant;
    if (xpState.byActivity[activityKey]) {
        xpState.byActivity[activityKey].actions += 1;
        xpState.byActivity[activityKey].xp += grant;
    }
    xpState.lastGain = {
        amount: grant,
        activity: activityKey,
        at: new Date().toISOString()
    };

    db.get('commanders').find({ username }).assign({ chronicleXp: xpState }).write();
    return xpState;
}

function grantCommanderAgeGold(username, amount) {
    const commander = db.get('commanders').find({ username }).value();
    if (!commander) return null;
    const grant = Math.max(0, Math.floor(Number(amount) || 0));
    const nextGold = resolveCommanderAgeGold(commander) + grant;
    db.get('commanders').find({ username }).assign({ ageGold: nextGold }).write();
    return nextGold;
}

function ensureGuildBountyPool(referenceNation = '') {
    let state = readGuildBountyState();
    const expired = resolveExpiredBounties(state);
    state = expired.state;

    expired.resolvedEvaded.forEach((bounty) => {
        grantCommanderAgeGold(bounty.targetUsername, BOUNTY_REWARDS.targetEvadeGold);
        const target = db.get('commanders').find({ username: bounty.targetUsername }).value();
        const nationKey = resolveCouncilBoardNationKey(target);
        if (nationKey) {
            awardNationTreasuryRsd(nationKey, BOUNTY_REWARDS.targetEvadeNationRsd, {
                eventType: 'main-drop',
                awardedBy: 'guild-bounty-evade'
            });
        }
        deliverGuildBountyAlert(bounty.targetUsername);
    });

    const commanders = (db.get('commanders').value() || []).filter((entry) => {
        const name = String(entry?.username || '').trim();
        return name && !isHiddenRegistrationUsername(name);
    });

    state = refreshBountyPool(state, commanders, buildGuildBountyContext(referenceNation));
    writeGuildBountyState(state);
    return state;
}

function buildGuildHubResponse(commander, settlementTier) {
    const tier = normalizeSettlementTier(settlementTier);
    const hub = buildGuildHubManifest(commander, tier);
    let bounties = [];

    if (isBountyVenueTier(tier)) {
        const bountyState = ensureGuildBountyPool(resolveCommanderMapNationKey(commander));
        bounties = listPublicBounties(bountyState, commander);
    }

    return {
        hub,
        bounties,
        bountyRewards: BOUNTY_REWARDS
    };
}

app.get('/api/portal/age/guild/state', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();
    const settlementTier = normalizeSettlementTier(req.query?.settlementTier || 'village');

    res.json({
        status: 'ok',
        action: 'guild-state',
        settlementTier,
        ...buildGuildStatePayload(commander),
        ...buildGuildHubResponse(commander, settlementTier),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/guild/training-battle', (req, res) => {
    try {
        const username = resolveLedgerCommanderUsername(req.body?.username || '');
        if (!username) {
            return sendApiError(res, 'NEXUS-GEN-002');
        }

        let commander = db.get('commanders').find({ username }).value();
        if (!commander) {
            return sendApiError(res, 'NEXUS-GEN-004');
        }

        ensureCommanderAgeRoster(commander);
        commander = db.get('commanders').find({ username }).value();

        const settlementTier = normalizeSettlementTier(req.body?.settlementTier || 'village');
        const trainingMode = String(req.body?.trainingMode || 'street-patrol').trim().toLowerCase();

        const result = executeGuildTrainingBattleWithLedger(commander, trainingMode, settlementTier);
        if (!result.ok) {
            return sendApiError(res, result.errorCode || 'NEXUS-AGE-017');
        }

        persistCommanderGuildLedger(username, {
            ageArmy: result.ageArmy,
            rank: result.rank,
            ageGuildXp: result.ageGuildXp,
            ageProvisions: result.ageProvisions,
            ageGold: result.ageGold
        });

        commander = db.get('commanders').find({ username }).value();

        res.json({
            status: 'ok',
            action: 'guild-training-battle',
            trainingMode: result.trainingMode,
            trainingModeLabel: result.trainingModeLabel,
            winner: result.winner,
            endReason: result.endReason,
            roundsPlayed: result.roundsPlayed,
            infantryRounds: result.infantryRounds,
            commanderHpRemaining: result.commanderHpRemaining,
            npcHpRemaining: result.npcHpRemaining,
            commanderMorale: result.commanderMorale,
            npcMorale: result.npcMorale,
            commanderUnits: result.commanderUnits,
            npcUnits: result.npcUnits,
            commanderForce: result.commanderForce,
            npcForce: result.npcForce,
            log: result.log,
            xpGain: result.xpGain,
            xpBreakdown: result.xpBreakdown || null,
            lootEntries: result.lootEntries || [],
            lootGoldTotal: result.lootGoldTotal || 0,
            injuriesApplied: result.injuriesApplied,
            rankPromoted: result.rankPromoted,
            rankPromotions: result.rankPromotions,
            provisionsGranted: result.provisionsGranted,
            ageGuildXp: result.ageGuildXp,
            ageGuildXpRequired: result.ageGuildXpRequired,
            ageGuildXpProgress: result.ageGuildXpProgress,
            rank: result.rank,
            unitsTotal: result.unitsTotal,
            unitsUninjured: result.unitsUninjured,
            unitsInjured: result.unitsInjured,
            unitsHealthProgress: result.unitsHealthProgress,
            ageGold: resolveCommanderAgeGold(commander),
            ageProvisions: result.ageProvisions,
            ageArmy: result.ageArmy,
            commanderGear: result.commanderGear,
            unitXpGains: result.unitXpGains || [],
            unitsReadyToPromote: result.unitsReadyToPromote || [],
            unitsReadyToPromoteCount: result.unitsReadyToPromoteCount || 0,
            commanderComposition: result.commanderComposition || null,
            npcComposition: result.npcComposition || null,
            classId: resolveClassIdFromPath(commander.path),
            perk1Branch: normalizeClassPerk1Branch(
                commander?.ageClassPerkChoices?.perk1 || commander?.ageClassPerk1Branch
            ),
            ...buildGuildHubResponse(commander, settlementTier),
            ...buildAgeMovementStatePayload(username, commander)
        });
    } catch (err) {
        console.error('[NEXUS] guild training-battle uncaught:', err);
        return sendApiError(res, 'NEXUS-GEN-001');
    }
});

app.get('/api/portal/age/units/evolution', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'unit-evolution-state',
        ...buildUnitEvolutionPayload(commander),
        ageArmy: resolveCommanderAgeArmy(commander)
    });
});

app.post('/api/portal/age/units/promote-rank', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const result = executeUnitRankPromotion(
        commander,
        req.body?.catalogUnitId,
        req.body?.rank,
        req.body?.quantity
    );
    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-027', {
            unlockRank: result.unlockRank
        });
    }

    persistCommanderGuildLedger(username, {
        ageArmy: result.ageArmy,
        ageProvisions: result.ageProvisions
    });

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'unit-promote-rank',
        provisionsSpent: result.provisionsSpent,
        quantityPromoted: result.quantityPromoted,
        promotedFrom: result.promotedFrom,
        promotedTo: result.promotedTo,
        promotionLabel: result.promotionLabel,
        unitName: result.unitName,
        ageProvisions: result.ageProvisions,
        ageArmy: result.ageArmy,
        ...buildUnitEvolutionPayload(commander)
    });
});

app.post('/api/portal/age/units/evolve-tier', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const result = executeUnitTierEvolution(
        commander,
        req.body?.catalogUnitId,
        req.body?.rank,
        req.body?.quantity
    );
    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-012', {
            unlockRank: result.unlockRank
        });
    }

    persistCommanderGuildLedger(username, {
        ageArmy: result.ageArmy,
        ageProvisions: result.ageProvisions
    });

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'unit-evolve-tier',
        provisionsSpent: result.provisionsSpent,
        fromUnitId: result.fromUnitId,
        toUnitId: result.toUnitId,
        fromName: result.fromName,
        toName: result.toName,
        unitsEvolved: result.unitsEvolved,
        ageProvisions: result.ageProvisions,
        ageArmy: result.ageArmy,
        ...buildUnitEvolutionPayload(commander)
    });
});

app.post('/api/portal/age/guild/heal', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const result = executeGuildHeal(commander, req.body?.mode);
    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-019');
    }

    persistCommanderGuildLedger(username, {
        ageArmy: result.ageArmy,
        ageGold: result.ageGold
    });

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'guild-heal',
        mode: result.mode,
        goldSpent: result.goldSpent,
        healedCount: result.healedCount,
        ageGold: result.ageGold,
        ageArmy: result.ageArmy,
        unitsTotal: result.unitsTotal,
        unitsUninjured: result.unitsUninjured,
        unitsInjured: result.unitsInjured,
        unitsHealthProgress: result.unitsHealthProgress,
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/guild/trade-convoy/purchase', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const settlementTier = normalizeSettlementTier(req.body?.settlementTier || 'village');
    const hub = buildGuildHubManifest(commander, settlementTier);
    const tradeJob = hub.jobs.find((job) => job.id === 'trade-convoy');
    if (!tradeJob?.available) {
        return sendApiError(res, 'NEXUS-AGE-020');
    }

    const result = executeTradeConvoyPurchase(commander, req.body?.lotId);
    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-011');
    }

    persistCommanderGuildLedger(username, {
        ageGold: result.ageGold,
        ageGuildMerch: result.ageGuildMerch
    });

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'guild-trade-convoy-purchase',
        lot: result.lot,
        goldSpent: result.goldSpent,
        ageGold: result.ageGold,
        ageGuildMerch: result.ageGuildMerch,
        ...buildGuildHubResponse(commander, settlementTier),
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/guild/bounties/accept', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const settlementTier = normalizeSettlementTier(req.body?.settlementTier || 'village');
    if (!isBountyVenueTier(settlementTier)) {
        return sendApiError(res, 'NEXUS-AGE-021');
    }

    const hub = buildGuildHubManifest(commander, settlementTier);
    const bountyJob = hub.jobs.find((job) => job.id === 'player-bounties');
    if (!bountyJob?.available) {
        return sendApiError(res, 'NEXUS-AGE-020');
    }

    const hunterMapNation = resolveCommanderMapNationKey(commander);
    let state = ensureGuildBountyPool(hunterMapNation);
    const result = acceptBounty(
        state,
        commander,
        req.body?.bountyId,
        buildGuildBountyContext(hunterMapNation)
    );
    if (!result.ok) {
        return sendApiError(res, result.errorCode || 'NEXUS-AGE-023');
    }

    writeGuildBountyState(result.state);
    persistCommanderGuildLedger(username, {
        ageGuildAcceptedBountyId: result.ageGuildAcceptedBountyId
    });

    if (result.alertTargetUsername) {
        deliverGuildBountyAlert(result.alertTargetUsername, username);
    }

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'guild-bounty-accept',
        bounty: result.bounty,
        ageGuildAcceptedBountyId: result.ageGuildAcceptedBountyId,
        ...buildGuildHubResponse(commander, settlementTier),
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/guild/bounties/claim-pvp', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const targetUsername = String(req.body?.targetUsername || '').trim();
    const guildState = readGuildBountyState();
    const guildResult = claimBountyPvpVictory(guildState, commander, targetUsername);
    const hqResult = claimHqBountyPvpVictory(readHqBountyProgram(), commander, targetUsername);

    if (!guildResult.ok && !hqResult.ok) {
        return sendApiError(res, guildResult.errorCode || hqResult.errorCode || 'NEXUS-AGE-023');
    }

    if (guildResult.ok) {
        writeGuildBountyState(guildResult.state);
    }
    if (hqResult.ok) {
        writeHqBountyProgram(hqResult.program);
    }

    const responseExtra = {
        hqBountyCollected: Boolean(hqResult.ok),
        hqBountyTarget: hqResult.ok ? hqResult.target : null
    };

    if (guildResult.ok) {
        persistCommanderGuildLedger(username, {
            ageGuildAcceptedBountyId: null,
            ageGold: resolveCommanderAgeGold(commander) + guildResult.rewards.hunterGold
        });

        grantCommanderChronicleXp(username, guildResult.rewards.hunterChronicleXp, 'pvpAttacks');

        const hunterNation = resolveCouncilBoardNationKey(commander);
        if (hunterNation) {
            awardNationTreasuryRsd(hunterNation, guildResult.rewards.hunterNationRsd, {
                eventType: 'main-drop',
                awardedBy: 'guild-bounty-claim'
            });
        }
    }

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: guildResult.ok ? 'guild-bounty-claim-pvp' : 'hq-bounty-claim-pvp',
        rewards: guildResult.ok ? guildResult.rewards : null,
        bounty: guildResult.ok ? guildResult.bounty : null,
        ...responseExtra,
        ageGold: resolveCommanderAgeGold(commander),
        chronicleXp: normalizeCommanderChronicleXp(commander.chronicleXp),
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/travel', (req, res) => {
    try {
        const username = resolveLedgerCommanderUsername(req.body?.username || '');
        if (!username) {
            return sendApiError(res, 'NEXUS-GEN-002');
        }

        const commander = db.get('commanders').find({ username }).value();
        if (!commander) {
            return sendApiError(res, 'NEXUS-GEN-004');
        }

        const gameNation = resolveCommanderMapNationKey(commander);
        if (!gameNation) {
            return sendApiError(res, 'NEXUS-AGE-008');
        }

        const rawTargetCityId = String(req.body?.targetCityId || '').trim();
        const targetCityId = resolveMovementTargetCityId(rawTargetCityId);
        const movement = readCommanderMovementRecord(username, gameNation);
        const store = readAgeMovementStore();

        const validation = validateTravel(
            gameNation,
            movement.catalogCityId,
            targetCityId,
            store.cityHolders
        );
        if (validation.errorCode) {
            return sendApiError(res, validation.errorCode);
        }

        const spend = spendMovePoints(movement, validation.connection?.movePointCost || 1);
        if (spend.errorCode) {
            return sendApiError(res, spend.errorCode);
        }

        const resolvedCityId = validation.targetCity?.id || targetCityId;
        const nextRecord = writeCommanderMovementRecord(username, {
            ...movement,
            catalogCityId: resolvedCityId,
            movePoints: spend.movePoints,
            lastMovePointRegenAt: spend.lastMovePointRegenAt
        });

        res.json({
            status: 'ok',
            action: 'travel',
            ...buildAgeMovementStatePayload(username, commander),
            catalogCityId: nextRecord.catalogCityId,
            movePoints: nextRecord.movePoints,
            lastMovePointRegenAt: nextRecord.lastMovePointRegenAt,
            targetCityId: resolvedCityId
        });
    } catch (err) {
        console.error('[NEXUS] POST /api/portal/age/travel failed:', err);
        return sendApiError(res, 'NEXUS-GEN-001');
    }
});

app.post('/api/portal/age/assault', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCommanderMapNationKey(commander);
    if (!gameNation) {
        return sendApiError(res, 'NEXUS-AGE-008');
    }

    const storageNation = resolveArmyGroupsStorageNation(commander);
    const armyGroupsState = storageNation
        ? readNationArmyGroupsForNation(storageNation)
        : null;
    if (armyGroupsState && findArmyGroupLedBy(armyGroupsState, username)) {
        return sendApiError(
            res,
            'NEXUS-AGE-030',
            'Launch assaults from the map while leading an army group — your group attacks together and disbands afterward.'
        );
    }

    const targetCityId = String(req.body?.targetCityId || '').trim();
    const movement = readCommanderMovementRecord(username, gameNation);
    const store = readAgeMovementStore();

    const validation = validateAssault(
        gameNation,
        movement.catalogCityId,
        targetCityId,
        store.cityHolders,
        areNationsAllied
    );
    if (validation.errorCode) {
        return sendApiError(res, validation.errorCode);
    }

    const spend = spendMovePoints(movement, validation.connection?.movePointCost || 1);
    if (spend.errorCode) {
        return sendApiError(res, spend.errorCode);
    }

    const targetCity = validation.targetCity;
    const previousHolder = resolveCityHolder(targetCity, store.cityHolders);
    const playersInCity = normalizePlayersInCityCount(req.body?.playersInCity);

    ensureCommanderAgeRoster(commander);
    commander = db.get('commanders').find({ username }).value();

    const battleResult = executeCityAssaultBattleWithLedger(commander, targetCity, playersInCity);
    if (!battleResult.ok) {
        return sendApiError(res, battleResult.errorCode || 'NEXUS-AGE-017');
    }

    persistCommanderGuildLedger(username, {
        rank: battleResult.rank,
        ageGuildXp: battleResult.ageGuildXp,
        ageProvisions: Math.max(
            0,
            Math.floor(Number(resolveCommanderAgeProvisions(commander)) || 0) + (battleResult.provisionsGranted || 0)
        )
    });

    commander = db.get('commanders').find({ username }).value();

    let nextRecord = writeCommanderMovementRecord(username, {
        catalogCityId: movement.catalogCityId,
        movePoints: spend.movePoints,
        lastMovePointRegenAt: spend.lastMovePointRegenAt
    });

    let captureReward = null;
    const assaultVictory = battleResult.winner === 'commander';
    let armyGroupDefeat = null;

    if (assaultVictory) {
        recordCityCapture(
            store,
            targetCityId,
            getCouncilBoardStorageKey(gameNation),
            previousHolder
        );
        writeAgeMovementStore(store);

        nextRecord = writeCommanderMovementRecord(username, {
            catalogCityId: targetCityId,
            movePoints: spend.movePoints,
            lastMovePointRegenAt: spend.lastMovePointRegenAt
        });

        captureReward = awardNationTreasuryForCaptureEvent(
            gameNation,
            'city-capture',
            playersInCity,
            {
                cityId: targetCityId,
                cityName: targetCity.name,
                awardedBy: username
            }
        );
    } else if (storageNation && armyGroupsState) {
        const defeatPrep = prepareArmyGroupDefeatForMember({
            state: armyGroupsState,
            defeatedUsername: username,
            nationKey: gameNation,
            cityHolders: store.cityHolders,
            isAlliedFn: areNationsAllied
        });
        if (defeatPrep.ok && !defeatPrep.skipped) {
            const writeGroups = writeNationArmyGroupsForNation(storageNation, defeatPrep.normalizedState);
            if (!writeGroups.errorCode) {
                const relocations = applyArmyGroupRelocationAssignments(
                    defeatPrep.relocationPlan.assignments,
                    gameNation
                );
                armyGroupDefeat = {
                    dismissedGroupId: defeatPrep.dismissedGroupId,
                    groupType: defeatPrep.groupType,
                    relocationMode: defeatPrep.relocationPlan.mode,
                    evacuationCityId: defeatPrep.relocationPlan.evacuationCityId || null,
                    relocations
                };
                const selfRelocation = relocations.find((entry) => entry.username === username);
                if (selfRelocation) {
                    nextRecord = writeCommanderMovementRecord(username, {
                        catalogCityId: selfRelocation.catalogCityId,
                        movePoints: spend.movePoints,
                        lastMovePointRegenAt: spend.lastMovePointRegenAt
                    });
                }
            }
        }
    }

    res.json({
        status: 'ok',
        action: 'assault',
        assaultVictory,
        armyGroupDefeat,
        winner: battleResult.winner,
        endReason: battleResult.endReason,
        roundsPlayed: battleResult.roundsPlayed,
        infantryRounds: battleResult.infantryRounds,
        log: battleResult.log,
        xpGain: battleResult.xpGain,
        xpBreakdown: battleResult.xpBreakdown || null,
        rank: battleResult.rank,
        rankPromoted: battleResult.rankPromoted,
        rankPromotions: battleResult.rankPromotions,
        provisionsGranted: battleResult.provisionsGranted,
        ageGuildXp: battleResult.ageGuildXp,
        ageGuildXpRequired: battleResult.ageGuildXpRequired,
        ageGuildXpProgress: battleResult.ageGuildXpProgress,
        catalogCityId: nextRecord.catalogCityId,
        movePoints: nextRecord.movePoints,
        movePointsMax: getMovePointRules().movePointsMax,
        lastMovePointRegenAt: nextRecord.lastMovePointRegenAt,
        targetCityId,
        previousHolderNationId: previousHolder,
        newHolderNationId: assaultVictory ? getCouncilBoardStorageKey(gameNation) : previousHolder,
        cityHolders: store.cityHolders,
        cityLosers: store.cityLosers,
        captureReward: captureReward && !captureReward.errorCode ? {
            grantedRsd: captureReward.grantedRsd,
            treasury: captureReward.treasury
        } : null,
        rules: getMovePointRules(),
        ...buildGuildStatePayload(commander),
        ...buildAgeMovementStatePayload(username, commander)
    });
});

app.post('/api/portal/age/transfer-ownership', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const gameNation = resolveCommanderMapNationKey(commander);
    if (!gameNation) {
        return sendApiError(res, 'NEXUS-AGE-008');
    }

    const targetCityId = String(req.body?.targetCityId || '').trim();
    const movement = readCommanderMovementRecord(username, gameNation);
    const store = readAgeMovementStore();

    const validation = validateTransfer(
        gameNation,
        movement.catalogCityId,
        targetCityId,
        store.cityHolders,
        areNationsAllied
    );
    if (validation.errorCode) {
        return sendApiError(res, validation.errorCode);
    }

    const targetCity = validation.targetCity;
    const allyNationId = validation.allyNationId;
    const transferCost = validation.transferRsdCost || TRANSFER_OWNERSHIP_RSD_COST;

    const debit = debitNationTreasuryRsd(gameNation, transferCost, {
        eventType: 'city-capture',
        cityId: targetCityId,
        cityName: targetCity.name,
        awardedBy: username
    });
    if (debit.errorCode) {
        return sendApiError(res, debit.errorCode);
    }

    const credit = awardNationTreasuryRsd(allyNationId, transferCost, {
        eventType: 'city-capture',
        cityId: targetCityId,
        cityName: targetCity.name,
        awardedBy: username
    });
    if (credit.errorCode) {
        return sendApiError(res, credit.errorCode);
    }

    const previousHolder = resolveCityHolder(targetCity, store.cityHolders);
    recordCityCapture(
        store,
        targetCityId,
        getCouncilBoardStorageKey(gameNation),
        previousHolder
    );
    writeAgeMovementStore(store);

    res.json({
        status: 'ok',
        action: 'transfer-ownership',
        targetCityId,
        previousHolderNationId: previousHolder,
        newHolderNationId: getCouncilBoardStorageKey(gameNation),
        transferRsdCost: transferCost,
        allyNationId,
        payerTreasury: debit.treasury,
        allyTreasury: credit.treasury,
        cityHolders: store.cityHolders,
        cityLosers: store.cityLosers,
        rules: getMovePointRules()
    });
});

app.post('/api/portal/game-chat/system-events', (req, res) => {
    const requester = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!requester || !isMailboxRecipientRosterAdmin(requester)) {
        return sendApiError(res, 'NEXUS-GAME-005');
    }

    let store = readGameChatStore();
    const result = appendGameChatSystemEventToStore(store, req.body?.text);
    if (result.errorCode || result.error) {
        return sendStoreError(res, result);
    }

    store = writeGameChatStore(store);
    res.json({ status: 'ok', message: result.entry });
});

app.patch('/api/portal/game-chat/ui', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const nextPreferences = patchGameChatUiPreferences(commander, req.body || {});
    db.get('commanders')
        .find({ username })
        .assign({
            preferences: nextPreferences,
            dossierUpdatedAt: new Date().toISOString()
        })
        .write();

    res.json({
        status: 'ok',
        ui: getGameChatUiFromCommander({ preferences: nextPreferences })
    });
});

app.post('/api/portal/presence', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const inAge = req.body?.inAge === true;
    const onCommunityChat = req.body?.onCommunityChat === true;
    const lastActivityAt = Number(req.body?.lastActivityAt);

    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const sessionUsername = String(req.session?.username || '').trim();
    const normalized = normalizeLedgerUsername(username);
    if (sessionUsername && normalized && sessionUsername.toLowerCase() === normalized.toLowerCase()) {
        const clientActivity = Number.isFinite(lastActivityAt) && lastActivityAt > 0
            ? lastActivityAt
            : Date.now();
        touchPortalSessionActivity(req, clientActivity);
        if (isPortalSessionInactive(req)) {
            return destroyPortalSessionForInactivity(req, res, () => {
                res.status(401).json({
                    status: 'error',
                    code: 'NEXUS-AUTH-017',
                    inactivityLogout: true,
                    message: 'Your portal session expired after 6 hours of inactivity.'
                });
            });
        }
    }

    touchPortalBrowseSession(username, {
        onCommunityChat,
        lastActivityAt: Number.isFinite(lastActivityAt) && lastActivityAt > 0 ? lastActivityAt : undefined
    });

    if (inAge) {
        touchAgeSession(username, { markOnline: true });
    } else {
        const normalized = normalizeLedgerUsername(username);
        const existing = normalized ? ageSessionByUser.get(normalized) : null;
        if (existing) {
            existing.lastSeen = Date.now();
            existing.isOnline = false;
            ageSessionByUser.set(normalized, existing);
        }
    }

    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/presence/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (username) {
        removeAgeSession(username);
        removePortalBrowseSession(username);
    }
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/age/join', (req, res) => {
    const sessionUsername = String(req.session?.username || '').trim();
    const bodyUsername = String(req.body?.username || '').trim();
    const username = resolvePortalAccountUsername(bodyUsername || sessionUsername, req);
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    if (sessionUsername && bodyUsername && bodyUsername.toLowerCase() !== sessionUsername.toLowerCase()) {
        return sendApiError(res, 'NEXUS-AUTH-011');
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const termsGate = assertCommanderAcceptedTermsForJoinAge(commander, req);
    if (!termsGate.ok) {
        return sendApiError(res, termsGate.code, {
            message: termsGate.message
        });
    }

    const ageSlug = normalizeOfficialAgeSlug(req.body?.ageSlug || readPortalGameAgeMeta().activeSlug);
    const ageChatReset = prepareCountryChatForAgeStart(ageSlug);
    ensureAgeCampaignRecord(db);
    maybeStartAgeCampaignClock(db);

    touchPortalBrowseSession(username);
    touchAgeSession(username, { markOnline: true, refreshActiveWindow: true });

    ensureCommanderAgeRoster(commander);

    let rosterCommander = db.get('commanders').find({ username }).value() || commander;
    const enrollFromPortal = req.body?.enrollFromPortal === true;
    const hasEnrolledNation = Boolean(resolveCatalogNationKey(rosterCommander?.gameNation));
    const enrollmentStaleAfterReset = Boolean(
        readPortalCommanderAccountResetAt()
        && !commanderHasValidAgePortalEnrollment(rosterCommander)
    );
    const requiresFreshNationEnrollment = !hasEnrolledNation || enrollmentStaleAfterReset;

    if (!enrollFromPortal) {
        if (!hasEnrolledNation || !commanderHasValidAgePortalEnrollment(rosterCommander)) {
            return sendApiError(res, 'NEXUS-AGE-038', {
                evicted: true,
                commanderAccountResetAt: readPortalCommanderAccountResetAt()
            });
        }
    }

    const shouldAssignRandomNation = Boolean(
        enrollFromPortal
        && requiresFreshNationEnrollment
        && (req.body?.assignRandomNation === true || isPortalDirectAgeJoinEnabled())
    );

    if (shouldAssignRandomNation) {
        const nationPatch = buildRandomNationEnrollmentPatch(req.body?.nationId, { allowRandom: true });
        if (nationPatch) {
            db.get('commanders')
                .find({ username })
                .assign(nationPatch)
                .write();
            rosterCommander = db.get('commanders').find({ username }).value() || rosterCommander;
            ensureCommanderAgeRoster(rosterCommander);
            rosterCommander = db.get('commanders').find({ username }).value() || rosterCommander;

            const movementNation = resolveCommanderMapNationKey(rosterCommander);
            const reconciledMovement = normalizeCommanderMovementRecord({}, movementNation);
            writeCommanderMovementRecord(username, reconciledMovement);
        }
    }

    if (isPortalDirectAgeJoinEnabled()) {
        const movementNation = resolveCommanderMapNationKey(rosterCommander);
        if (movementNation) {
            const currentMovement = readCommanderMovementRecord(username, movementNation);
            writeCommanderMovementRecord(
                username,
                buildDirectAgeJoinMovementRefillRecord(currentMovement, movementNation)
            );
        }
    }

    const mapNation = resolveCommanderMapNationKey(rosterCommander);
    const armyFocus = normalizeArmyFocusValue(req.body?.armyFocus);
    if (armyFocus) {
        const movement = readCommanderMovementRecord(username, mapNation);
        writeCommanderMovementRecord(username, {
            ...movement,
            armyFocus
        });
    }

    if (enrollFromPortal) {
        const enrolledAt = new Date().toISOString();
        db.get('commanders')
            .find({ username })
            .assign({ agePortalEnrolledAt: enrolledAt })
            .write();
        rosterCommander = db.get('commanders').find({ username }).value() || rosterCommander;
    }

    res.json({
        status: 'ok',
        ageSlug,
        countryChatWiped: ageChatReset.wiped,
        directAgeJoin: isPortalDirectAgeJoinEnabled(),
        gameNation: rosterCommander?.gameNation || '',
        onboardingRegionId: rosterCommander?.onboardingRegionId || '',
        commanderAccountResetAt: readPortalCommanderAccountResetAt(),
        ...buildAgeMovementStatePayload(username, rosterCommander),
        ...getPortalLiveMetricsPayload()
    });
});

app.post('/api/portal/age/admin/reset-all-commander-accounts', (req, res) => {
    const actingUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!actingUsername) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }
    if (!isAgeLedgerAdminUsername(actingUsername)) {
        return sendApiError(res, 'NEXUS-AGE-018');
    }

    const resetResult = performAllCommanderAccountReset(db, resetCommanderRecordPreservingAchievements);
    clearAgeMovementCommanderPositions();
    clearAllAgeSessions();

    res.json({
        status: 'ok',
        action: 'reset-all-commander-accounts',
        resetCount: resetResult.resetCount,
        directAgeJoin: isPortalDirectAgeJoinEnabled(),
        commanderAccountResetAt: resetResult.commanderAccountResetAt
    });
});

app.post('/api/portal/age/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    markAgeSessionOffline(username);
    res.json({
        status: 'ok',
        ...getPortalLiveMetricsPayload()
    });
});

app.post('/api/portal/age/commander-reset', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return sendApiError(res, 'NEXUS-GEN-002');
    }

    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (mode !== 'rank' && mode !== 'exile') {
        return sendApiError(res, 'NEXUS-AGE-026');
    }

    const sessionKey = String(req.body?.sessionKey || '').trim();
    if (!sessionKey) {
        return sendApiError(res, 'NEXUS-AGE-024');
    }

    let commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return sendApiError(res, 'NEXUS-GEN-004');
    }

    const enrolledNation = resolveCatalogNationKey(commander.gameNation);
    if (!enrolledNation) {
        return sendApiError(res, 'NEXUS-AGE-024');
    }

    const userKey = username.toLowerCase();
    const currentUsage = normalizeCommanderAgeResetUsage(commander.ageResetUsage);
    if (!canApplyCommanderAgeReset(currentUsage, userKey, sessionKey, mode)) {
        return sendApiError(res, 'NEXUS-AGE-025');
    }

    const ledgerPatch = mode === 'exile'
        ? buildCommanderExileResetLedgerPatch()
        : buildCommanderRankResetLedgerPatch();
    const nextUsage = incrementAgeResetUsage(currentUsage, userKey, sessionKey, mode);

    db.get('commanders')
        .find({ username })
        .assign({
            ...ledgerPatch,
            ageResetUsage: nextUsage,
            dossierUpdatedAt: new Date().toISOString()
        })
        .write();

    if (mode === 'exile') {
        clearCommanderMovementRecord(username);
        removeAgeSession(username);
        maybeFinalizeCountryChatAfterAgeVacant();
    }

    commander = db.get('commanders').find({ username }).value();

    res.json({
        status: 'ok',
        action: 'commander-reset',
        mode,
        rank: Number(commander.rank) || 1,
        ageGold: resolveCommanderAgeGold(commander),
        ageProvisions: resolveCommanderAgeProvisions(commander),
        ageGuildXp: Math.max(0, Math.floor(Number(commander.ageGuildXp) || 0)),
        gameNation: String(commander.gameNation || '').trim(),
        ageArmy: [],
        ageResetUsage: normalizeCommanderAgeResetUsage(commander.ageResetUsage),
        ...getPortalLiveMetricsPayload()
    });
});

/* ==========================================
   NEXUS MODULE: IGNITION
   ========================================== */

/* --- Section: Server Boot --- */

/* Block 15: Nexus Engine Ignition */
function runAgeRosterResetMigrationOnce() {
    const MIGRATION_KEY = 'age-roster-gold-reset-v1';
    const portal = db.get('portal').value() || {};
    if (portal[MIGRATION_KEY]) return;

    const commanders = db.get('commanders').value() || [];
    const resetCount = resetAllCommanderAgeArmies(commanders);

    commanders.forEach((commander, index) => {
        if (!isAgeLedgerAdminUsername(commander?.username)) return;
        commanders[index] = {
            ...commander,
            ...buildAdminGoldRestorePatch(),
            ageArmy: []
        };
    });

    db.set('commanders', commanders).write();
    db.get('portal').assign({ [MIGRATION_KEY]: new Date().toISOString() }).write();
    console.log(`[NEXUS] Age roster reset migration applied (${resetCount} commanders).`);
}

app.listen(PORT, () => {
    runAgeRosterResetMigrationOnce();
    backfillWelcomeSystemMessagesForAllCommanders();
    backfillFirstTimerAchievementForAllCommanders();
    clearPortalUpdateImminentFlag();
    ensureAgeCampaignRecord(db);
    tickAgeCampaignLifecycle();
    setInterval(tickAgeCampaignLifecycle, AGE_CAMPAIGN_TICK_MS);
    console.log(`========================================`);
    console.log(` NEXUS ENGINE ONLINE: Port ${PORT}`);
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.11`);
    console.log(`========================================`);
});

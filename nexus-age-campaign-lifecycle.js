'use strict';

/**
 * NEXUS — authoritative Age campaign lifecycle (15-day active + 24h transition).
 * At age conclusion, resets all commander accounts while preserving achievements.
 */

const AGE_CAMPAIGN_ACTIVE_MAX_MS = 15 * 24 * 60 * 60 * 1000;
const AGE_CAMPAIGN_TRANSITION_MS = 24 * 60 * 60 * 1000;
const AGE_CAMPAIGN_TICK_MS = 60 * 1000;

function normalizeAgeCampaign(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const lastAutoResetForAgeNumber = Number(source.lastAutoResetForAgeNumber);
    const era = String(source.era || 'alpha').trim().toLowerCase();
    return {
        era: era === 'beta' ? 'beta' : 'alpha',
        number: Math.max(1, Math.floor(Number(source.number) || 1)),
        state: source.state === 'transition' ? 'transition' : 'active',
        activeStartedAt: source.activeStartedAt ? String(source.activeStartedAt) : null,
        transitionEndsAt: source.transitionEndsAt ? String(source.transitionEndsAt) : null,
        autoLifecycleEnabled: source.autoLifecycleEnabled !== false,
        // Paused by default during Alpha testing (never-ending age); unpaused when Beta begins.
        timersPaused: source.timersPaused !== false,
        lastConcludedAt: source.lastConcludedAt ? String(source.lastConcludedAt) : null,
        lastAutoResetAt: source.lastAutoResetAt ? String(source.lastAutoResetAt) : null,
        lastAutoResetForAgeNumber: Number.isFinite(lastAutoResetForAgeNumber)
            ? Math.floor(lastAutoResetForAgeNumber)
            : null
    };
}

/** Display label for portal HUD / chat — Alpha stays open-ended; Beta uses Age: Beta N. */
function formatAgeCampaignDisplayLabel(campaign) {
    const normalized = normalizeAgeCampaign(campaign);
    if (normalized.era === 'beta') {
        return `Age: Beta ${normalized.number}`;
    }
    return 'Age Alpha';
}

function buildAgeSlugForCampaign(campaign) {
    const normalized = normalizeAgeCampaign(campaign);
    if (normalized.era === 'beta') {
        return `beta-${normalized.number}`;
    }
    return 'alpha';
}

function readAgeCampaignFromPortal(portal) {
    const campaign = readAgeCampaignFromPortalRaw(portal);
    return {
        ...campaign,
        displayLabel: formatAgeCampaignDisplayLabel(campaign),
        activeSlug: buildAgeSlugForCampaign(campaign)
    };
}

function readAgeCampaignFromPortalRaw(portal) {
    return normalizeAgeCampaign(portal?.ageCampaign);
}

function writeAgeCampaignToPortal(db, campaign) {
    db.get('portal').assign({ ageCampaign: normalizeAgeCampaign(campaign) }).write();
    return normalizeAgeCampaign(campaign);
}

function ensureAgeCampaignRecord(db, nowMs = Date.now()) {
    const portal = db.get('portal').value() || {};
    let campaign = readAgeCampaignFromPortal(portal);
    if (campaign.activeStartedAt) {
        return campaign;
    }

    const gameAge = portal.gameAge && typeof portal.gameAge === 'object' ? portal.gameAge : {};
    const nowIso = new Date(nowMs).toISOString();
    let activeStartedAt = gameAge.startedAt ? String(gameAge.startedAt) : null;
    let state = 'active';
    let transitionEndsAt = null;

    if (gameAge.endedAt && !activeStartedAt) {
        const endedMs = Date.parse(String(gameAge.endedAt));
        if (Number.isFinite(endedMs)) {
            state = 'transition';
            transitionEndsAt = new Date(endedMs + AGE_CAMPAIGN_TRANSITION_MS).toISOString();
        }
    }

    campaign = normalizeAgeCampaign({
        ...campaign,
        state,
        activeStartedAt,
        transitionEndsAt
    });
    writeAgeCampaignToPortal(db, campaign);
    return campaign;
}

function maybeStartAgeCampaignClock(db, nowMs = Date.now()) {
    const portal = db.get('portal').value() || {};
    const campaign = readAgeCampaignFromPortal(portal);
    if (campaign.state !== 'active' || campaign.activeStartedAt || campaign.timersPaused) {
        return campaign;
    }

    const nowIso = new Date(nowMs).toISOString();
    return writeAgeCampaignToPortal(db, {
        ...campaign,
        activeStartedAt: nowIso
    });
}

function performAllCommanderAccountReset(db, resetCommanderRecordPreservingAchievements) {
    const commanders = db.get('commanders').value() || [];
    let resetCount = 0;
    const nextCommanders = commanders.map((commander) => {
        if (!commander?.username) return commander;
        resetCount += 1;
        return resetCommanderRecordPreservingAchievements(commander);
    });

    db.set('commanders', nextCommanders).write();
    const commanderAccountResetAt = new Date().toISOString();
    db.get('portal').assign({ commanderAccountResetAt }).write();

    return { resetCount, commanderAccountResetAt };
}

function concludeAgeCampaign(db, campaign, hooks, nowMs = Date.now()) {
    const current = normalizeAgeCampaign(campaign);
    if (current.lastAutoResetForAgeNumber === current.number) {
        return { skipped: true, reason: 'already_reset_for_age', campaign: current };
    }

    const resetResult = performAllCommanderAccountReset(
        db,
        hooks.resetCommanderRecordPreservingAchievements
    );

    if (typeof hooks.clearAgeMovementCommanders === 'function') {
        hooks.clearAgeMovementCommanders();
    }
    if (typeof hooks.clearAllAgeSessions === 'function') {
        hooks.clearAllAgeSessions();
    }
    if (typeof hooks.finalizeCountryChatForAgeEnd === 'function') {
        hooks.finalizeCountryChatForAgeEnd();
    }

    const nowIso = new Date(nowMs).toISOString();
    const nextCampaign = writeAgeCampaignToPortal(db, {
        ...current,
        state: 'transition',
        transitionEndsAt: new Date(nowMs + AGE_CAMPAIGN_TRANSITION_MS).toISOString(),
        lastConcludedAt: nowIso,
        lastAutoResetAt: resetResult.commanderAccountResetAt,
        lastAutoResetForAgeNumber: current.number
    });

    if (typeof hooks.onAgeConcluded === 'function') {
        hooks.onAgeConcluded({
            ageNumber: current.number,
            resetCount: resetResult.resetCount,
            commanderAccountResetAt: resetResult.commanderAccountResetAt,
            campaign: nextCampaign
        });
    }

    return {
        skipped: false,
        action: 'conclude_age',
        ageNumber: current.number,
        resetCount: resetResult.resetCount,
        commanderAccountResetAt: resetResult.commanderAccountResetAt,
        campaign: nextCampaign
    };
}

function beginNextAgeCampaign(db, campaign, hooks, nowMs = Date.now()) {
    const current = normalizeAgeCampaign(campaign);
    const nextNumber = current.number + 1;
    const nowIso = new Date(nowMs).toISOString();

    const nextCampaign = writeAgeCampaignToPortal(db, {
        ...current,
        number: nextNumber,
        state: 'active',
        activeStartedAt: nowIso,
        transitionEndsAt: null
    });

    if (typeof hooks.onNextAgeStarted === 'function') {
        hooks.onNextAgeStarted({ ageNumber: nextNumber, campaign: nextCampaign, startedAt: nowIso });
    }

    if (typeof hooks.prepareCountryChatForAgeStart === 'function') {
        hooks.prepareCountryChatForAgeStart();
    }

    return {
        action: 'begin_next_age',
        ageNumber: nextNumber,
        campaign: nextCampaign
    };
}

function evaluateAgeCampaignLifecycle(db, hooks, nowMs = Date.now()) {
    if (!db) return null;

    let campaign = ensureAgeCampaignRecord(db, nowMs);
    if (!campaign.autoLifecycleEnabled || campaign.timersPaused) {
        return { action: 'idle', reason: campaign.timersPaused ? 'timers_paused' : 'auto_disabled', campaign };
    }

    if (campaign.state === 'active') {
        campaign = maybeStartAgeCampaignClock(db, nowMs);
        const startedMs = Date.parse(campaign.activeStartedAt || '');
        if (!Number.isFinite(startedMs)) {
            return { action: 'idle', reason: 'missing_active_started_at', campaign };
        }

        const elapsedMs = nowMs - startedMs;
        if (elapsedMs < AGE_CAMPAIGN_ACTIVE_MAX_MS) {
            return { action: 'active', campaign, elapsedMs, remainingMs: AGE_CAMPAIGN_ACTIVE_MAX_MS - elapsedMs };
        }

        return concludeAgeCampaign(db, campaign, hooks, nowMs);
    }

    if (campaign.state === 'transition') {
        const endsMs = Date.parse(campaign.transitionEndsAt || '');
        if (!Number.isFinite(endsMs) || nowMs < endsMs) {
            return {
                action: 'transition',
                campaign,
                remainingMs: Number.isFinite(endsMs) ? Math.max(0, endsMs - nowMs) : null
            };
        }

        return beginNextAgeCampaign(db, campaign, hooks, nowMs);
    }

    return { action: 'idle', campaign };
}

function createAgeCampaignLifecycleRunner(db, hooks) {
    let ticking = false;

    return function tickAgeCampaignLifecycle() {
        if (ticking) return null;
        ticking = true;
        try {
            return evaluateAgeCampaignLifecycle(db, hooks, Date.now());
        } catch (err) {
            console.error('[NEXUS] Age campaign lifecycle tick failed:', err);
            return null;
        } finally {
            ticking = false;
        }
    };
}

module.exports = {
    AGE_CAMPAIGN_ACTIVE_MAX_MS,
    AGE_CAMPAIGN_TRANSITION_MS,
    AGE_CAMPAIGN_TICK_MS,
    normalizeAgeCampaign,
    formatAgeCampaignDisplayLabel,
    buildAgeSlugForCampaign,
    readAgeCampaignFromPortal,
    readAgeCampaignFromPortalRaw,
    writeAgeCampaignToPortal,
    ensureAgeCampaignRecord,
    maybeStartAgeCampaignClock,
    performAllCommanderAccountReset,
    concludeAgeCampaign,
    beginNextAgeCampaign,
    evaluateAgeCampaignLifecycle,
    createAgeCampaignLifecycleRunner
};

/**
 * NEXUS — Game balance monitor (baseline checks + JSONL audit trail).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, 'data', 'balance-monitor-baseline.json');
const LOG_DIRECTORY = path.join(__dirname, 'runtime');
const LOG_PATH = path.join(LOG_DIRECTORY, 'balance-monitor.jsonl');

const DEFAULT_BASELINE = Object.freeze({
    version: '2026-05-31',
    notes: 'Default desktop testing baseline for Age progression pacing.',
    recruitment: {
        maxUnitsPerRecruitEvent: 25,
        maxTier1UnitsBeforeRank7: 70
    },
    progression: {
        maxProvisionGrantPerPromotion: 110,
        maxEarlyProvisionGrantPerPromotion: 85,
        earlyRankCutoff: 10,
        maxPromotionsPerBattleEvent: 1
    },
    battle: {
        maxXpGainPerTrainingBattle: 60,
        maxInjuriesPerTrainingBattle: 6
    }
});

let cachedBaseline = null;

function toFiniteFloor(value, fallback = 0) {
    const numeric = Math.floor(Number(value));
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clampMin(value, min) {
    return Math.max(min, toFiniteFloor(value, min));
}

function readBaselineFromDisk() {
    try {
        if (!fs.existsSync(BASELINE_PATH)) return null;
        const raw = fs.readFileSync(BASELINE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function getBaseline() {
    if (cachedBaseline) return cachedBaseline;
    const fromDisk = readBaselineFromDisk();
    cachedBaseline = fromDisk || DEFAULT_BASELINE;
    return cachedBaseline;
}

function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIRECTORY)) {
        fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    }
}

function detectRecruitmentIssues(payload, baseline) {
    const issues = [];
    const recruitment = baseline?.recruitment || {};
    const maxUnits = clampMin(recruitment.maxUnitsPerRecruitEvent, 1);
    const maxTier1BeforeRank7 = clampMin(recruitment.maxTier1UnitsBeforeRank7, 1);

    const quantity = clampMin(payload?.quantity, 0);
    if (quantity > maxUnits) {
        issues.push({
            code: 'NEXUS-BALANCE-RECRUIT-001',
            severity: 'warning',
            message: `Recruit event quantity ${quantity} exceeds baseline ${maxUnits}.`
        });
    }

    const commanderRank = clampMin(payload?.commanderRank, 1);
    const unitsTotal = clampMin(payload?.unitsTotal, 0);
    const upcPerUnit = clampMin(payload?.upcPerUnit, 0);
    if (commanderRank < 7 && upcPerUnit <= 11 && unitsTotal > maxTier1BeforeRank7) {
        issues.push({
            code: 'NEXUS-BALANCE-RECRUIT-002',
            severity: 'warning',
            message: `Tier-1 roster size ${unitsTotal} before rank 7 exceeds baseline ${maxTier1BeforeRank7}.`
        });
    }

    return issues;
}

function detectRankProgressionIssues(payload, baseline) {
    const issues = [];
    const progression = baseline?.progression || {};
    const maxGrant = clampMin(progression.maxProvisionGrantPerPromotion, 1);
    const maxEarlyGrant = clampMin(progression.maxEarlyProvisionGrantPerPromotion, 1);
    const earlyCutoff = clampMin(progression.earlyRankCutoff, 2);
    const maxPromotionsPerBattle = clampMin(progression.maxPromotionsPerBattleEvent, 1);

    const promotions = clampMin(payload?.promotionsCount, 0);
    const grant = clampMin(payload?.provisionsGranted, 0);
    const rankAfter = clampMin(payload?.rankAfter, 1);
    const rankBefore = clampMin(payload?.rankBefore, 1);

    if (promotions > maxPromotionsPerBattle) {
        issues.push({
            code: 'NEXUS-BALANCE-PROG-001',
            severity: 'warning',
            message: `Battle produced ${promotions} promotions; baseline allows ${maxPromotionsPerBattle}.`
        });
    }

    if (grant > maxGrant) {
        issues.push({
            code: 'NEXUS-BALANCE-PROG-002',
            severity: 'warning',
            message: `Provision grant ${grant} exceeds baseline ${maxGrant}.`
        });
    }

    if (rankAfter <= earlyCutoff && rankBefore < rankAfter && grant > maxEarlyGrant) {
        issues.push({
            code: 'NEXUS-BALANCE-PROG-003',
            severity: 'warning',
            message: `Early-rank provision grant ${grant} exceeds early baseline ${maxEarlyGrant}.`
        });
    }

    return issues;
}

function detectTrainingBattleIssues(payload, baseline) {
    const issues = [];
    const battle = baseline?.battle || {};
    const maxXp = clampMin(battle.maxXpGainPerTrainingBattle, 1);
    const maxInjuries = clampMin(battle.maxInjuriesPerTrainingBattle, 1);

    const xpGain = clampMin(payload?.xpGain, 0);
    const injuries = clampMin(payload?.injuriesApplied, 0);

    if (xpGain > maxXp) {
        issues.push({
            code: 'NEXUS-BALANCE-BATTLE-001',
            severity: 'warning',
            message: `Training XP gain ${xpGain} exceeds baseline ${maxXp}.`
        });
    }

    if (injuries > maxInjuries) {
        issues.push({
            code: 'NEXUS-BALANCE-BATTLE-002',
            severity: 'warning',
            message: `Training injuries ${injuries} exceed baseline ${maxInjuries}.`
        });
    }

    return issues;
}

function detectIssues(eventType, payload, baseline) {
    if (eventType === 'recruitment') {
        return detectRecruitmentIssues(payload, baseline);
    }
    if (eventType === 'rank-progression') {
        return detectRankProgressionIssues(payload, baseline);
    }
    if (eventType === 'training-battle') {
        return detectTrainingBattleIssues(payload, baseline);
    }
    return [];
}

function recordBalanceEvent(eventType, payload = {}) {
    try {
        const baseline = getBaseline();
        const issues = detectIssues(eventType, payload, baseline);
        const entry = {
            at: new Date().toISOString(),
            eventType: String(eventType || 'unknown').trim() || 'unknown',
            baselineVersion: String(baseline?.version || 'unknown'),
            payload,
            issues
        };
        ensureLogDirectory();
        fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
        return { ok: true, issues };
    } catch {
        return { ok: false, issues: [] };
    }
}

module.exports = {
    BASELINE_PATH,
    LOG_PATH,
    getBaseline,
    recordBalanceEvent
};

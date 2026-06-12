/**
 * NEXUS — Emerald Barrier Banner 25-node skill execution (battle scope).
 */
'use strict';

const path = require('path');
const fs = require('fs');

const SCHEMA_PATH = path.join(__dirname, 'docs', 'blessed-banners-schema.json');

const BANNER_ID = 'emerald-barrier';
const NODE = Object.freeze({
    phalanxPledge: 'eb-01',
    phalanxFoundation: 'eb-03',
    logisticsReserve: 'eb-13',
    sentinelSentry: 'eb-14',
    balancedBulwark: 'eb-03',
    layeredDeflection: 'eb-04',
    shrapnelScreen: 'eb-05',
    aegisConduit: 'eb-06',
    integratedGuard: 'eb-07',
    anchorFormation: 'eb-08',
    stalemateMastery: 'eb-09',
    reinforcedJoists: 'eb-10',
    unbrokenWall: 'eb-11',
    bastionReserve: 'eb-12',
    ironcladVault: 'eb-15',
    borderWarden: 'eb-16',
    defensiveMobilization: 'eb-17',
    counterIntelligence: 'eb-18',
    citadelIntercept: 'eb-19',
    secureNetworks: 'eb-20',
    watchtowerNetwork: 'eb-21',
    bastionHazard: 'eb-22',
    garrisonMatrix: 'eb-23',
    moralAnchor: 'eb-24',
    sovereigntyFort: 'eb-25'
});

let schemaCache = null;

function loadBlessedBannersSchema() {
    if (schemaCache) return schemaCache;
    schemaCache = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    return schemaCache;
}

function resolveEmeraldSchema() {
    return loadBlessedBannersSchema().banners[BANNER_ID];
}

function normalizeUnlockedNodeIds(raw) {
    if (!raw) return new Set();
    const list = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw.unlockedNodeIds) ? raw.unlockedNodeIds : raw.unlockedPerkIds);
    return new Set((list || []).map((id) => String(id || '').trim()).filter(Boolean));
}

function resolveEmeraldBannerContext(commanderOrContext) {
    const ctx = commanderOrContext?.banner
        ? commanderOrContext
        : { banner: commanderOrContext?.ageBannerState || commanderOrContext?.ageBannerPerks };

    const banner = ctx.banner;
    if (!banner || String(banner.bannerId || '').trim() !== BANNER_ID) {
        return null;
    }

    const unlocked = normalizeUnlockedNodeIds(banner);
    if (!unlocked.has(NODE.phalanxPledge)) {
        unlocked.add(NODE.phalanxPledge);
    }

    return {
        bannerId: BANNER_ID,
        unlocked,
        battleRole: String(ctx.battleRole || '').trim() || 'attacker',
        environment: String(ctx.environment || ctx.battleEnvironment || '').trim(),
        isNationDefense: Boolean(ctx.isNationDefense),
        isNationAssault: Boolean(ctx.isNationAssault),
        battleOutcome: String(ctx.battleOutcome || '').trim()
    };
}

function hasNode(emeraldCtx, nodeId) {
    return Boolean(emeraldCtx?.unlocked?.has(nodeId));
}

function resolveValidLaneHpThreshold(emeraldCtx, schema) {
    const doc = schema || loadBlessedBannersSchema();
    if (hasNode(emeraldCtx, NODE.sovereigntyFort)) {
        return Number(doc.validLaneHpThresholdSovereignty) || 0.10;
    }
    return Number(doc.validLaneHpThresholdDefault) || 0.15;
}

function environmentMatches(emeraldCtx, flags = []) {
    const env = String(emeraldCtx?.environment || '').trim();
    if (!env || !flags.length) return false;
    return flags.includes(env);
}

function applyEmeraldBarrierInit(army, context, log) {
    const emerald = resolveEmeraldBannerContext(context);
    if (!emerald || !army?.lanes) return emerald;

    const comp = army.composition;
    if (!comp) return emerald;

    let defenseStack = 1;
    if (hasNode(emerald, NODE.phalanxPledge)) {
        defenseStack *= 1.05;
    }
    if (hasNode(emerald, NODE.phalanxFoundation)
        || hasNode(emerald, NODE.logisticsReserve)
        || hasNode(emerald, 'eb-02')) {
        defenseStack *= 1.03;
    }
    if (hasNode(emerald, NODE.sentinelSentry) && emerald.battleRole === 'defender') {
        defenseStack *= 1.05;
    }
    if (hasNode(emerald, NODE.phalanxFoundation) && comp.validActiveLaneCount === 2) {
        defenseStack *= 1.20;
    }

    if (!army.battleState) army.battleState = {};
    army.battleState.emeraldDefenseFactor = defenseStack;

    if (defenseStack > 1) {
        log?.push(
            `${army.label} — Emerald Barrier defense doctrine: incoming damage ×${(1 / defenseStack).toFixed(2)} on active lanes.`
        );
    }

    if (hasNode(emerald, NODE.unbrokenWall) && emerald.battleRole === 'defender') {
        const infantry = army.lanes.infantry;
        if (infantry) {
            const hpBoost = Math.floor(Math.max(0, infantry.startingHp || infantry.hp) * 0.20);
            infantry.startingHp = (infantry.startingHp || infantry.hp) + hpBoost;
            infantry.currentHp = (infantry.currentHp || infantry.hp) + hpBoost;
            infantry.hp = infantry.hp + hpBoost;
            infantry.armorMultiplier = (infantry.armorMultiplier || 1) * 1.25;
            army.startingHp += hpBoost;
            army.currentHp += hpBoost;
            log?.push(`${army.label} — Phalanx Apex: infantry +20% HP, +25% armor while defending.`);
        }
    }

    if (!army.battleState) army.battleState = {};
    army.battleState.emeraldBarrier = emerald;
    return emerald;
}

function resolveEmeraldCounterSuppression(normalCounter, defenderArmy, emerald) {
    if (!emerald || normalCounter <= 1) return normalCounter;
    const comp = defenderArmy?.composition;
    if (!hasNode(emerald, NODE.balancedBulwark) || !comp || comp.validActiveLaneCount !== 3) {
        return normalCounter;
    }
    const suppressed = 1 + ((normalCounter - 1) * 0.75);
    if (defenderArmy.battleState) {
        defenderArmy.battleState.emeraldBalancedBulwark = true;
    }
    return Math.max(1, suppressed);
}

function resolveEmeraldMatrixDisruption(normalCounter, defenderArmy, emerald) {
    if (!emerald || normalCounter <= 1) return normalCounter;
    const comp = defenderArmy?.composition;
    if (!hasNode(emerald, NODE.balancedBulwark) || !comp || comp.validActiveLaneCount < 3) {
        return normalCounter;
    }
    return resolveEmeraldCounterSuppression(normalCounter, defenderArmy, emerald);
}

function applyIntegratedGuardAbsorb(defenderArmy, phaseId) {
    const emerald = defenderArmy?.battleState?.emeraldBarrier;
    if (!emerald || !hasNode(emerald, NODE.integratedGuard)) return 1;

    const comp = defenderArmy.composition;
    if (!comp?.validActiveLanes?.length) return 1;

    const woundedLane = comp.validActiveLanes.find((laneId) => {
        const lane = defenderArmy.lanes[laneId];
        const start = Math.max(1, Math.floor(Number(lane?.startingHp) || 0));
        const current = Math.max(0, Math.floor(Number(lane?.currentHp) || 0));
        return (current / start) < 0.40;
    });

    if (!woundedLane) return 1;
    if (phaseId === woundedLane) return 1;
    return 0.85;
}

function resolveLayeredDeflectionFactor(defenderArmy, phaseId, emerald) {
    if (phaseId !== 'cavalry' || !hasNode(emerald, NODE.layeredDeflection)) return 1;
    if (!defenderArmy?.lanes?.cavalry) return 1;
    return 1 / 1.20;
}

function resolveIronCurtainFactor(emerald) {
    if (!emerald || !hasNode(emerald, NODE.garrisonMatrix)) return 1;
    if (emerald.battleRole !== 'defender' || !emerald.isNationDefense) return 1;
    return 0.85;
}

function resolveHoldTheBreachFactor(defenderArmy, phaseId, emerald) {
    if (!emerald || !hasNode(emerald, NODE.reinforcedJoists)) return 1;
    if (emerald.battleRole !== 'defender' || phaseId !== 'beasts') return 1;
    if (!defenderArmy?.lanes?.beasts) return 1;
    return 0.75;
}

function resolveExposedFlankFactor(emerald, attackerIsMonoBuild) {
    if (!emerald || !hasNode(emerald, NODE.bastionHazard)) return 1;
    if (emerald.battleRole !== 'defender' || !attackerIsMonoBuild) return 1;
    return 0.85;
}

function resolveShrapnelScreenMultiplier(attackerArmy, defenderArmy, phaseId, emerald, defenderDealtRanged) {
    if (phaseId !== 'ranged' || !hasNode(emerald, NODE.shrapnelScreen)) return 1;
    if (!defenderDealtRanged) return 1;
    return 1.20;
}

function resolveAegisConduitBlockBonus(defenderArmy, emerald) {
    if (!hasNode(emerald, NODE.aegisConduit)) return 0;
    const artillery = defenderArmy?.lanes?.ranged;
    const start = Math.max(0, Math.floor(Number(artillery?.startingHp) || 0));
    const current = Math.max(0, Math.floor(Number(artillery?.currentHp) || 0));
    if (!start) return 0;
    return (current / start) * 0.10;
}

function resolveStalemateMasteryDefense(defenderArmy, infantryRound, emerald) {
    if (!hasNode(emerald, NODE.stalemateMastery) || !infantryRound) return 1;
    return 1 + (0.03 * infantryRound);
}


function resolveMoralAnchorMoraleFactor(defenderArmy, emerald) {
    if (!hasNode(emerald, NODE.moralAnchor)) return 1;
    const comp = defenderArmy?.composition;
    if (!comp) return 1;
    const laneWiped = comp.validActiveLanes.some((laneId) => {
        const lane = defenderArmy.lanes[laneId];
        return Math.max(0, Math.floor(Number(lane?.currentHp) || 0)) <= 0;
    });
    return laneWiped ? 0.5 : 1;
}

function applyEmeraldIncomingDamageModifiers(damage, defenderArmy, phaseId, options = {}) {
    const emerald = defenderArmy?.battleState?.emeraldBarrier
        || resolveEmeraldBannerContext(defenderArmy?.battleState?.context);
    if (!emerald) return damage;

    let adjusted = Math.max(0, Math.floor(Number(damage) || 0));
    const defenseFactor = Math.max(1, Number(defenderArmy?.battleState?.emeraldDefenseFactor) || 1);
    if (defenseFactor > 1) {
        adjusted = Math.floor(adjusted / defenseFactor);
    }
    adjusted = Math.floor(adjusted * resolveLayeredDeflectionFactor(defenderArmy, phaseId, emerald));
    adjusted = Math.floor(adjusted * applyIntegratedGuardAbsorb(defenderArmy, phaseId));
    adjusted = Math.floor(adjusted * resolveIronCurtainFactor(emerald));
    adjusted = Math.floor(adjusted * resolveHoldTheBreachFactor(defenderArmy, phaseId, emerald));
    adjusted = Math.floor(adjusted * resolveExposedFlankFactor(emerald, options.attackerIsMonoBuild));

    if (options.infantryRound) {
        const stalemate = resolveStalemateMasteryDefense(defenderArmy, options.infantryRound, emerald);
        adjusted = Math.max(0, Math.floor(adjusted / stalemate));
    }

    return adjusted;
}

function applyEmeraldOutgoingDamageModifiers(damage, attackerArmy, defenderArmy, phaseId, options = {}) {
    const emerald = attackerArmy?.battleState?.emeraldBarrier
        || resolveEmeraldBannerContext(attackerArmy?.battleState?.context);
    if (!emerald) return damage;

    let adjusted = Math.max(0, Math.floor(Number(damage) || 0));
    adjusted = Math.floor(adjusted * resolveShrapnelScreenMultiplier(
        attackerArmy,
        defenderArmy,
        phaseId,
        emerald,
        options.defenderDealtRanged
    ));

    if (phaseId === 'beasts') {
        const blockBonus = resolveAegisConduitBlockBonus(attackerArmy, emerald);
        if (blockBonus > 0) {
            adjusted = Math.floor(adjusted * (1 + blockBonus));
        }
    }

    return adjusted;
}

function resolvePickedBranchRoot(exclusivity, unlocked) {
    if (!exclusivity) return null;
    if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
        return exclusivity.branchRoots.find((id) => unlocked.has(id)) || null;
    }
    if (exclusivity.leftRoots?.some((id) => unlocked.has(id))) return 'left';
    if (exclusivity.rightRoots?.some((id) => unlocked.has(id))) return 'right';
    return null;
}

function isNodeExcludedByBranch(nodeId, node, allNodes, exclusivity, unlocked) {
    const picked = resolvePickedBranchRoot(exclusivity, unlocked);
    if (!picked) return false;

    if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
        if (exclusivity.branchRoots.includes(nodeId)) return nodeId !== picked;
        const branch = node?.branch || allNodes.find((entry) => entry.id === nodeId)?.branch;
        if (!branch || branch === 'root' || branch === 'trunk' || branch === 'pinnacle') return false;
        const pickedBranch = allNodes.find((entry) => entry.id === picked)?.branch;
        return Boolean(pickedBranch && branch !== pickedBranch);
    }

    const isLeft = exclusivity.leftRoots.includes(nodeId) || node?.branch === 'A';
    const isRight = exclusivity.rightRoots.includes(nodeId) || node?.branch === 'B';
    return (picked === 'left' && isRight) || (picked === 'right' && isLeft);
}

function resolveBranchPathByRoot(schema, rootId) {
    const paths = schema?.branchPaths;
    if (!Array.isArray(paths)) return null;
    return paths.find((entry) => entry.rootId === rootId) || null;
}

function resolveBranchExclusivityBlock(nodeId, allNodes, exclusivity, unlocked, schema) {
    const node = allNodes.find((entry) => entry.id === nodeId);
    if (!isNodeExcludedByBranch(nodeId, node, allNodes, exclusivity, unlocked)) {
        return null;
    }

    if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
        const picked = resolvePickedBranchRoot(exclusivity, unlocked);
        const pickedPath = resolveBranchPathByRoot(schema, picked);
        const pickedLabel = pickedPath?.name || exclusivity.branchLabels?.[picked] || 'Another path';
        return { ok: false, reason: `${pickedLabel} already chosen.` };
    }

    const picked = resolvePickedBranchRoot(exclusivity, unlocked);
    if (picked === 'left') return { ok: false, reason: 'Branch A already chosen.' };
    if (picked === 'right') return { ok: false, reason: 'Branch B already chosen.' };
    return { ok: false, reason: 'Another branch already chosen.' };
}

function countPaidUnlocks(unlocked, schema) {
    const doc = schema || resolveEmeraldSchema();
    const autoIds = new Set((doc.nodes || []).filter((entry) => entry.autoUnlock).map((entry) => entry.id));
    let count = 0;
    unlocked.forEach((id) => {
        if (!autoIds.has(id)) count += 1;
    });
    return count;
}

function resolveEmeraldNodeUnlockCost(node, unlocked, schema) {
    if (!node || node.autoUnlock) return 0;
    return countPaidUnlocks(unlocked, schema) + 1;
}

function canUnlockEmeraldNode(nodeId, unlocked, schema) {
    const doc = schema || resolveEmeraldSchema();
    const node = doc.nodes.find((entry) => entry.id === nodeId);
    if (!node) return { ok: false, reason: 'Unknown node.' };

    if (unlocked.has(nodeId)) return { ok: false, reason: 'Already unlocked.' };

    const allNodes = doc.nodes;
    const parent = allNodes.find((entry) => (entry.linksTo || []).includes(nodeId));
    if (node.id !== NODE.phalanxPledge) {
        if (!parent || !unlocked.has(parent.id)) {
            const capstoneParent = (doc.pinnacleParents || []).find((id) => (allNodes.find((n) => n.id === id)?.linksTo || []).includes(nodeId));
            if (!capstoneParent || !unlocked.has(capstoneParent)) {
                return { ok: false, reason: 'Parent node not unlocked.' };
            }
        }
    }

    if (node.requiresAnyOf?.length) {
        const hasCap = node.requiresAnyOf.some((id) => unlocked.has(id));
        if (!hasCap) return { ok: false, reason: 'Requires a capstone branch.' };
    }

    const exclusivity = doc.branchExclusivity;
    if (exclusivity) {
        const branchBlock = resolveBranchExclusivityBlock(nodeId, allNodes, exclusivity, unlocked, doc);
        if (branchBlock) return branchBlock;
    }

    return { ok: true, node, cost: resolveEmeraldNodeUnlockCost(node, unlocked, doc) };
}

module.exports = {
    BANNER_ID,
    NODE,
    loadBlessedBannersSchema,
    resolveEmeraldSchema,
    normalizeUnlockedNodeIds,
    resolveEmeraldBannerContext,
    hasNode,
    resolveValidLaneHpThreshold,
    applyEmeraldBarrierInit,
    resolveEmeraldCounterSuppression,
    resolveEmeraldMatrixDisruption,
    applyEmeraldIncomingDamageModifiers,
    applyEmeraldOutgoingDamageModifiers,
    resolveMoralAnchorMoraleFactor,
    countPaidUnlocks,
    resolveEmeraldNodeUnlockCost,
    canUnlockEmeraldNode
};

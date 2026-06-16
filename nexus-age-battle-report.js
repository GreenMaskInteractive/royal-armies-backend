/**
 * NEXUS — Age battle report summaries (assault, border PvP, army group attacks).
 */
'use strict';

const { normalizeAgeArmy } = require('./nexus-age-roster');
const {
    buildCommanderUnitLine,
    prependCommanderLine,
    collectCommanderKills,
    resolveCommanderUsername
} = require('./nexus-age-battle-report-commander');

function stackKey(stack) {
    return String(stack?.catalogUnitId || stack?.name || stack?.class || 'unit').trim().toLowerCase();
}

function sumSideTotals(lines) {
    return (lines || []).reduce((acc, line) => ({
        count: acc.count + (line.count || 0),
        remaining: acc.remaining + (line.remaining || 0),
        healthy: acc.healthy + (line.healthy || 0),
        injured: acc.injured + (line.injured || 0),
        dead: acc.dead + (line.dead || 0),
        captured: acc.captured + (line.captured || 0)
    }), { count: 0, remaining: 0, healthy: 0, injured: 0, dead: 0, captured: 0 });
}

function buildUnitLinesFromArmyDiff(armyBefore, armyAfter) {
    const beforeMap = new Map();
    normalizeAgeArmy(armyBefore).forEach((stack) => {
        beforeMap.set(stackKey(stack), stack);
    });

    const afterMap = new Map();
    normalizeAgeArmy(armyAfter).forEach((stack) => {
        afterMap.set(stackKey(stack), stack);
    });

    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const lines = [];

    keys.forEach((key) => {
        const before = beforeMap.get(key);
        const after = afterMap.get(key);
        const count = Math.max(0, Math.floor(Number(before?.qty ?? after?.qty) || 0));
        const remaining = Math.max(0, Math.floor(Number(after?.qty) || 0));
        const injured = Math.min(remaining, Math.max(0, Math.floor(Number(after?.injuredQty) || 0)));
        const healthy = Math.max(0, remaining - injured);
        const dead = Math.max(0, count - remaining);

        if (!count && !remaining) return;

        lines.push({
            catalogUnitId: before?.catalogUnitId || after?.catalogUnitId || '',
            name: String(before?.name || after?.name || 'Unit').trim(),
            class: String(before?.class || after?.class || '').trim(),
            count,
            remaining,
            healthy,
            injured,
            dead,
            captured: 0
        });
    });

    lines.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    return lines;
}

function buildUnitLinesFromForceSummary(force) {
    const lines = (Array.isArray(force?.stacks) ? force.stacks : []).map((stack) => {
        const count = Math.max(0, Math.floor(Number(stack?.startingQty ?? stack?.qty) || 0));
        const remaining = Math.max(0, Math.floor(Number(stack?.survivorsQty ?? stack?.qty) || 0));
        return {
            catalogUnitId: stack?.catalogUnitId || '',
            name: String(stack?.name || 'Unit').trim(),
            class: String(stack?.class || '').trim(),
            count,
            remaining,
            healthy: remaining,
            injured: 0,
            dead: Math.max(0, count - remaining),
            captured: 0
        };
    }).filter((line) => line.count > 0);

    lines.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    return lines;
}

function buildReportSide(options = {}) {
    const label = String(options.label || 'Force').trim();
    const battleType = String(options.battleType || 'battle').trim();
    let unitLines = [];

    if (options.armyBefore !== undefined && options.armyAfter !== undefined) {
        unitLines = buildUnitLinesFromArmyDiff(options.armyBefore, options.armyAfter);
    } else {
        unitLines = buildUnitLinesFromForceSummary(options.forceSummary);
    }

    const isPlayerSide = options.isPlayerSide === true;
    const commanderLine = isPlayerSide && resolveCommanderUsername(options.commander)
        ? buildCommanderUnitLine({
            commander: options.commander,
            battleType,
            sideWon: options.sideWon === true,
            armyBefore: options.armyBefore,
            armyAfter: options.armyAfter,
            endReason: options.endReason || '',
            vulnerabilityBonus: options.vulnerabilityBonus
        })
        : null;
    unitLines = prependCommanderLine(unitLines, commanderLine);

    return {
        label,
        username: options.username || null,
        isPlayerSide,
        unitLines,
        totals: sumSideTotals(unitLines)
    };
}

function resolveWinnerLabel(winner, battleType) {
    const key = String(winner || '').trim().toLowerCase();
    if (key === 'commander' || key === 'attacker') return 'Victory';
    if (key === 'npc' || key === 'defender') return 'Defeat';
    if (key === 'draw') return 'Draw';
    if (key === 'attacker' && battleType === 'border-pvp') return 'Victory';
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Resolved';
}

function buildAgeBattleReport(options = {}) {
    const battleType = String(options.battleType || 'battle').trim();
    const endReason = String(options.outcomeLabel || options.endReason || '').trim();
    const attackerWon = String(options.winner || '').trim().toLowerCase() === 'attacker'
        || String(options.winner || '').trim().toLowerCase() === 'commander';

    const attacker = buildReportSide({
        ...(options.attacker || {}),
        battleType,
        endReason,
        sideWon: attackerWon
    });
    const defender = buildReportSide({
        ...(options.defender || {}),
        battleType,
        endReason,
        sideWon: !attackerWon && String(options.winner || '').trim().toLowerCase() !== 'draw'
    });

    const rankPromotions = Array.isArray(options.rankPromotions) ? options.rankPromotions : [];
    const unitPromotions = Array.isArray(options.unitPromotions) ? options.unitPromotions : [];
    const commanderKills = collectCommanderKills(attacker, defender);

    return {
        battleType,
        title: String(options.title || 'Battle Report').trim(),
        subtitle: String(options.subtitle || '').trim(),
        locationName: String(options.locationName || '').trim(),
        opponentName: String(options.opponentName || '').trim(),
        winner: String(options.winner || '').trim(),
        winnerLabel: resolveWinnerLabel(options.winner, battleType),
        outcomeLabel: endReason,
        attacker,
        defender,
        commanderKills,
        xpGain: Math.max(0, Math.floor(Number(options.xpGain) || 0)),
        goldGain: Math.max(0, Math.floor(Number(options.goldGain) || 0)),
        goldLoss: Math.max(0, Math.floor(Number(options.goldLoss) || 0)),
        provisionsGranted: Math.max(0, Math.floor(Number(options.provisionsGranted) || 0)),
        rankPromoted: Boolean(options.rankPromoted),
        rankPromotions,
        unitPromotions,
        captureTreasuryRsd: Math.max(0, Math.floor(Number(options.captureTreasuryRsd) || 0)),
        assaultVictory: options.assaultVictory === true,
        log: Array.isArray(options.log) ? options.log.slice(0, 120) : []
    };
}

module.exports = {
    buildAgeBattleReport,
    buildUnitLinesFromArmyDiff,
    buildUnitLinesFromForceSummary,
    sumSideTotals
};

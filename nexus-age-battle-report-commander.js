/**
 * NEXUS — Commander rows and kill resolution for Age battle reports.
 *
 * PvE: player commanders are extremely difficult to kill vs NPC garrisons.
 * PvP: commander kills depend on vulnerability (injured army), defeat severity, gear, terrain.
 */
'use strict';

const { normalizeAgeArmy, countAgeArmyUnits } = require('./nexus-age-roster');
const {
    buildCommanderRankMeta,
    getCommanderRankDisplayTitle
} = require('./nexus-commander-rank-titles');

function resolveCommanderUsername(commander) {
    return String(commander?.username || '').trim();
}

function resolveCommanderDisplayName(commander) {
    const username = resolveCommanderUsername(commander);
    const meta = buildCommanderRankMeta(commander);
    const rankTitle = getCommanderRankDisplayTitle(meta.rank, meta.path, meta.rankTitleGender);
    if (username && rankTitle) return `${username} — ${rankTitle}`;
    if (username) return username;
    return 'Commander';
}

function computeArmyInjuryRatio(army) {
    const counts = countAgeArmyUnits(normalizeAgeArmy(army));
    if (!counts.total) return 0;
    const injured = Math.max(0, counts.total - counts.uninjured);
    return injured / counts.total;
}

function isPvpBattleType(battleType) {
    const key = String(battleType || '').trim().toLowerCase();
    return key === 'border-pvp' || key === 'border-seize' || key === 'pvp';
}

function resolvePveCommanderOutcome({ sideWon, armyBefore, armyAfter, endReason }) {
    const injuryAfter = computeArmyInjuryRatio(armyAfter);
    const injuryBefore = computeArmyInjuryRatio(armyBefore);
    const heavyCasualties = injuryAfter >= 0.45 || injuryBefore >= 0.55;
    const routed = String(endReason || '').toLowerCase().includes('rout')
        || String(endReason || '').toLowerCase().includes('annihil');

    if (!sideWon && routed) {
        return {
            status: 'injured',
            remaining: 1,
            injured: 1,
            dead: 0,
            captured: 0,
            healthy: 0,
            note: 'Commander withdrew under heavy pressure but survived (NPC battles rarely claim commanders).'
        };
    }

    if (heavyCasualties) {
        return {
            status: 'injured',
            remaining: 1,
            injured: 1,
            dead: 0,
            captured: 0,
            healthy: 0,
            note: 'Commander took wounds while rallying the line.'
        };
    }

    return {
        status: 'survived',
        remaining: 1,
        injured: 0,
        dead: 0,
        captured: 0,
        healthy: 1,
        note: 'Commander held the field — garrison battles rarely end in commander deaths.'
    };
}

function resolvePvpCommanderKillChance({
    sideWon,
    armyBefore,
    endReason,
    vulnerabilityBonus = 0
}) {
    if (sideWon) return 0;

    const vulnerability = computeArmyInjuryRatio(armyBefore);
    const endKey = String(endReason || '').toLowerCase();
    const annihilated = endKey.includes('annihil');
    const routed = endKey.includes('rout');

    let chance = 0.05;
    chance += vulnerability * 0.42;
    if (vulnerability >= 0.75) chance += 0.12;
    if (annihilated) chance += 0.2;
    else if (routed) chance += 0.1;
    chance += Math.max(0, Math.min(0.15, Number(vulnerabilityBonus) || 0));

    return Math.min(0.78, Math.max(0, chance));
}

function resolvePvpCommanderOutcome({
    sideWon,
    armyBefore,
    armyAfter,
    endReason,
    vulnerabilityBonus = 0
}) {
    const killChance = resolvePvpCommanderKillChance({
        sideWon,
        armyBefore,
        endReason,
        vulnerabilityBonus
    });

    if (!sideWon && Math.random() < killChance) {
        return {
            status: 'killed',
            remaining: 0,
            injured: 0,
            dead: 1,
            captured: 0,
            healthy: 0,
            killChance: Math.round(killChance * 100),
            note: 'Commander slain while the army was vulnerable — equipment, terrain, and timing all matter in PvP.'
        };
    }

    const injuryAfter = computeArmyInjuryRatio(armyAfter);
    if (!sideWon && (injuryAfter >= 0.35 || computeArmyInjuryRatio(armyBefore) >= 0.5)) {
        return {
            status: 'injured',
            remaining: 1,
            injured: 1,
            dead: 0,
            captured: 0,
            healthy: 0,
            killChance: Math.round(killChance * 100),
            note: 'Commander survived but was wounded during the seize.'
        };
    }

    return {
        status: sideWon ? 'survived' : 'survived',
        remaining: 1,
        injured: 0,
        dead: 0,
        captured: 0,
        healthy: 1,
        killChance: Math.round(killChance * 100),
        note: sideWon
            ? 'Commander held the field.'
            : 'Commander escaped — PvP kills require catching a foe at their most vulnerable.'
    };
}

function buildCommanderUnitLine(options = {}) {
    const commander = options.commander;
    if (!commander) return null;

    const battleType = String(options.battleType || 'battle').trim();
    const sideWon = options.sideWon === true;
    const armyBefore = options.armyBefore || [];
    const armyAfter = options.armyAfter || armyBefore;
    const endReason = options.endReason || '';

    const outcome = isPvpBattleType(battleType)
        ? resolvePvpCommanderOutcome({
            sideWon,
            armyBefore,
            armyAfter,
            endReason,
            vulnerabilityBonus: options.vulnerabilityBonus
        })
        : resolvePveCommanderOutcome({
            sideWon,
            armyBefore,
            armyAfter,
            endReason
        });

    return {
        isCommander: true,
        catalogUnitId: 'commander',
        name: resolveCommanderDisplayName(commander),
        class: 'Commander',
        count: 1,
        remaining: outcome.remaining,
        healthy: outcome.healthy,
        injured: outcome.injured,
        dead: outcome.dead,
        captured: outcome.captured,
        commanderStatus: outcome.status,
        commanderUsername: resolveCommanderUsername(commander),
        commanderNote: outcome.note || '',
        commanderKillChance: outcome.killChance || null
    };
}

function prependCommanderLine(unitLines, commanderLine) {
    const lines = Array.isArray(unitLines) ? [...unitLines] : [];
    if (!commanderLine) return lines;
    return [commanderLine, ...lines];
}

function collectCommanderKills(attacker, defender) {
    const kills = [];
    [attacker, defender].forEach((side) => {
        const commanderLine = (side?.unitLines || []).find((line) => line?.isCommander);
        if (commanderLine?.commanderStatus === 'killed' && commanderLine.commanderUsername) {
            kills.push({
                username: commanderLine.commanderUsername,
                name: commanderLine.name,
                sideLabel: side.label || 'Commander'
            });
        }
    });
    return kills;
}

module.exports = {
    buildCommanderUnitLine,
    prependCommanderLine,
    collectCommanderKills,
    resolveCommanderDisplayName,
    computeArmyInjuryRatio,
    isPvpBattleType
};

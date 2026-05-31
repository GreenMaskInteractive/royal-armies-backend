/**
 * NEXUS — Age Adventurer's Guild training battle (commander army vs mixed NPC roster).
 *
 * Battle flow:
 *   1. Ranged volley
 *   2. Beasts clash
 *   3. Cavalry charge
 *   4. Infantry grind (up to 5 rounds)
 *
 * Victory: annihilation (0 HP/units) or opponent routes (morale / unsustainable losses).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { loadUnitPurchaseCatalog, getCatalogUnitById } = require('./nexus-age-recruitment');
const { resolveCommanderAgeArmy, normalizeAgeArmy } = require('./nexus-age-roster');

const PVP_MATRIX_PATH = path.join(__dirname, 'docs', 'pvp-class-opposition-matrix.json');

const PROMOTION_BY_RANK = {
    1: 'app',
    2: 'std',
    3: 'vet',
    4: 'mst',
    5: 'leg',
    6: 'elite'
};

const COMBAT_TYPE_TO_CLASS_ID = {
    PHYS_INF: 'physical_infantry',
    PHYS_CAV: 'physical_cavalry',
    PHYS_ART: 'physical_artillery',
    PHYS_BST: 'physical_beasts',
    MAG_INF: 'magic_infantry',
    MAG_CAV: 'magic_cavalry',
    MAG_ART: 'magic_artillery',
    MAG_BST: 'magic_beasts'
};

const BATTLE_PHASES = [
    { id: 'ranged', label: 'Phase 1 — Ranged Volley' },
    { id: 'beasts', label: 'Phase 2 — Beasts' },
    { id: 'cavalry', label: 'Phase 3 — Cavalry Charge' }
];

const INFANTRY_MAX_ROUNDS = 5;
const MORALE_START = 100;
const MORALE_ROUTE_THRESHOLD = 22;
const CASUALTY_ROUTE_RATIO = 0.68;

const DEFAULT_TRAINING_NPC_STACKS = [
    { catalogUnitId: 'recruit-shieldman-a', qty: 10 },
    { catalogUnitId: 'levy-archer-b', qty: 10 },
    { catalogUnitId: 'squire-rider', qty: 8 },
    { catalogUnitId: 'wild-wolf-a', qty: 8 },
    { catalogUnitId: 'acolyte', qty: 8 },
    { catalogUnitId: 'holder', qty: 8 }
];

let advantageLookupCache = null;

function loadAdvantageLookup() {
    if (advantageLookupCache) return advantageLookupCache;

    const lookup = new Map();
    try {
        const raw = fs.readFileSync(PVP_MATRIX_PATH, 'utf8');
        const matrix = JSON.parse(raw);
        (matrix.advantagePairs || []).forEach((pair) => {
            const attacker = String(pair.attacker || '').trim();
            const defender = String(pair.defender || '').trim();
            if (!attacker || !defender) return;
            if (!lookup.has(attacker)) lookup.set(attacker, new Set());
            lookup.get(attacker).add(defender);
        });
    } catch (_err) {
        /* fallback empty */
    }

    advantageLookupCache = lookup;
    return lookup;
}

function resolveCombatClassId(combatType) {
    const key = String(combatType || '').trim().toUpperCase();
    return COMBAT_TYPE_TO_CLASS_ID[key] || null;
}

function resolveBattlePhaseLane(combatType) {
    const type = String(combatType || '').trim().toUpperCase();
    if (type.includes('_ART')) return 'ranged';
    if (type.includes('_BST')) return 'beasts';
    if (type.includes('_CAV')) return 'cavalry';
    return 'infantry';
}

function resolveStackPromotionKey(stack, catalogUnit) {
    const rank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
    const fromRank = PROMOTION_BY_RANK[rank];
    if (fromRank && catalogUnit?.stats?.[fromRank]) return fromRank;

    const first = Array.isArray(catalogUnit?.promotions) && catalogUnit.promotions.length
        ? catalogUnit.promotions[0]
        : 'app';
    return first;
}

function resolveStackUnit(catalog, stack) {
    const catalogUnitId = String(stack?.catalogUnitId || '').trim();
    if (catalogUnitId) {
        const fromCatalog = getCatalogUnitById(catalog, catalogUnitId);
        if (fromCatalog) return fromCatalog;
    }

    const name = String(stack?.name || '').trim().toLowerCase();
    if (!name) return null;
    return (catalog?.units || []).find((unit) => String(unit.name || '').trim().toLowerCase() === name) || null;
}

function resolveStackCombatStats(stack, catalogUnit) {
    const promoKey = resolveStackPromotionKey(stack, catalogUnit);
    const stats = catalogUnit?.stats?.[promoKey] || {};
    const hp = Math.max(1, Math.floor(Number(stats.hp) || 1));
    const str = Math.max(0, Math.floor(Number(stats.str) || 0));
    const rng = Math.max(0, Math.floor(Number(stats.rng) || 0));
    const combatType = String(catalogUnit?.combatType || stack?.class || 'PHYS_INF').trim().toUpperCase();
    const doubleStrike = String(catalogUnit?.special || '').toUpperCase() === 'DOUBLE_STRIKE';

    return { hp, str, rng, combatType, doubleStrike };
}

function createEmptyLane() {
    return { attack: 0, hp: 0, units: 0, classWeight: {} };
}

function buildBattleArmy(label, stacks, catalog) {
    const army = {
        label,
        startingHp: 0,
        currentHp: 0,
        startingUnits: 0,
        currentUnits: 0,
        morale: MORALE_START,
        lanes: {
            ranged: createEmptyLane(),
            beasts: createEmptyLane(),
            cavalry: createEmptyLane(),
            infantry: createEmptyLane()
        },
        stacks: [],
        outcome: null,
        outcomeDetail: ''
    };

    (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        if (!qty) return;

        const catalogUnit = resolveStackUnit(catalog, stack);
        const stats = resolveStackCombatStats(stack, catalogUnit);
        const laneId = resolveBattlePhaseLane(stats.combatType);
        const lane = army.lanes[laneId];
        const classId = resolveCombatClassId(stats.combatType);
        const stackHp = stats.hp * qty;

        lane.hp += stackHp;
        lane.units += qty;

        if (laneId === 'ranged') {
            lane.attack += stats.rng * qty;
        } else if (laneId === 'cavalry') {
            const mult = stats.doubleStrike ? 2 : 1;
            lane.attack += stats.str * qty * mult;
        } else {
            lane.attack += stats.str * qty;
        }

        if (classId) {
            lane.classWeight[classId] = (lane.classWeight[classId] || 0) + qty;
        }

        army.stacks.push({
            name: catalogUnit?.displayName || catalogUnit?.name || stack.name || 'Unit',
            qty,
            combatType: stats.combatType,
            classId,
            phaseLane: laneId
        });
    });

    army.startingHp = Object.values(army.lanes).reduce((sum, lane) => sum + lane.hp, 0);
    army.currentHp = army.startingHp;
    army.startingUnits = army.stacks.reduce((sum, stack) => sum + stack.qty, 0);
    army.currentUnits = army.startingUnits;

    return army;
}

function resolvePrimaryDefenderClassFromArmy(army) {
    const merged = {};
    Object.values(army.lanes).forEach((lane) => {
        Object.entries(lane.classWeight || {}).forEach(([classId, weight]) => {
            merged[classId] = (merged[classId] || 0) + weight;
        });
    });

    let bestClass = null;
    let bestWeight = 0;
    Object.entries(merged).forEach(([classId, weight]) => {
        if (weight > bestWeight) {
            bestWeight = weight;
            bestClass = classId;
        }
    });
    return bestClass;
}

function resolveCounterMultiplierFromLane(lane, defenderClassId) {
    if (!defenderClassId || !lane?.classWeight) return 1;

    const lookup = loadAdvantageLookup();
    let bonusStacks = 0;
    let totalStacks = 0;

    Object.entries(lane.classWeight).forEach(([classId, weight]) => {
        totalStacks += weight;
        if (lookup.get(classId)?.has(defenderClassId)) {
            bonusStacks += weight;
        }
    });

    if (!totalStacks || !bonusStacks) return 1;
    return 1 + (0.5 * (bonusStacks / totalStacks));
}

function applyCasualties(army, damage) {
    const dealt = Math.min(Math.max(0, Math.floor(Number(damage) || 0)), army.currentHp);
    if (!dealt) return 0;

    const survivalRatio = army.currentHp > 0 ? (army.currentHp - dealt) / army.currentHp : 0;
    army.currentHp -= dealt;
    army.currentUnits = Math.max(0, Math.floor(army.currentUnits * survivalRatio));

    return dealt;
}

function applyMoraleShock(army, damageDealt) {
    if (!army.startingHp || !damageDealt) return;

    const phaseShock = Math.floor((damageDealt / army.startingHp) * 45);
    const heavyLossPenalty = (army.currentHp / army.startingHp) < 0.5 ? 8 : 0;
    army.morale = Math.max(0, army.morale - phaseShock - heavyLossPenalty);
}

function evaluateArmyOutcome(army) {
    if (army.outcome) return army.outcome;

    if (army.currentHp <= 0 || army.currentUnits <= 0) {
        army.outcome = 'annihilated';
        army.outcomeDetail = 'Annihilation — every unit was destroyed.';
        return army.outcome;
    }

    const hpRemainingRatio = army.currentHp / army.startingHp;
    if (army.morale <= MORALE_ROUTE_THRESHOLD) {
        army.outcome = 'routed';
        army.outcomeDetail = 'Morale collapse — the army breaks and retreats.';
        return army.outcome;
    }

    if (hpRemainingRatio <= (1 - CASUALTY_ROUTE_RATIO)) {
        army.outcome = 'routed';
        army.outcomeDetail = 'Unsustainable casualties — survivors rout from the field.';
        return army.outcome;
    }

    return null;
}

function formatArmyStatus(army) {
    return `${Math.max(0, army.currentHp)} HP · ${Math.max(0, army.currentUnits)} unit(s) · morale ${Math.max(0, army.morale)}`;
}

function resolveBattleWinner(commander, npc) {
    const commanderDown = commander.outcome === 'annihilated' || commander.outcome === 'routed';
    const npcDown = npc.outcome === 'annihilated' || npc.outcome === 'routed';

    if (npcDown && !commanderDown) {
        return {
            winner: 'commander',
            endReason: npc.outcome === 'annihilated' ? 'annihilation' : 'routing'
        };
    }
    if (commanderDown && !npcDown) {
        return {
            winner: 'npc',
            endReason: commander.outcome === 'annihilated' ? 'annihilation' : 'routing'
        };
    }
    if (commanderDown && npcDown) {
        if (commander.currentHp > npc.currentHp) {
            return { winner: 'commander', endReason: 'routing' };
        }
        if (npc.currentHp > commander.currentHp) {
            return { winner: 'npc', endReason: 'routing' };
        }
        return { winner: 'draw', endReason: 'mutual_rout' };
    }

    if (commander.currentHp > npc.currentHp) {
        return { winner: 'commander', endReason: 'infantry_phase' };
    }
    if (npc.currentHp > commander.currentHp) {
        return { winner: 'npc', endReason: 'infantry_phase' };
    }
    return { winner: 'draw', endReason: 'stalemate' };
}

function resolvePhaseStrike(attacker, defender, phaseId, phaseLabel, log) {
    if (attacker.outcome || defender.outcome) return false;

    const atkLane = attacker.lanes[phaseId];
    if (!atkLane?.attack) return false;

    const defenderClass = resolvePrimaryDefenderClassFromArmy(defender);
    const mod = resolveCounterMultiplierFromLane(atkLane, defenderClass);
    const damage = Math.floor(atkLane.attack * mod);
    const dealt = applyCasualties(defender, damage);
    applyMoraleShock(defender, dealt);

    const counterNote = mod > 1 ? ' · counter advantage' : '';
    log.push(
        `[${phaseLabel}] ${attacker.label} strikes for ${dealt} damage${counterNote}. `
        + `${defender.label}: ${formatArmyStatus(defender)}.`
    );

    const outcome = evaluateArmyOutcome(defender);
    if (outcome) {
        log.push(`${defender.label} — ${defender.outcomeDetail}`);
    }

    return Boolean(outcome);
}

function runBattlePhaseExchange(commander, npc, phaseId, phaseLabel, log) {
    log.push(`— ${phaseLabel} —`);

    const endedByCommanderStrike = resolvePhaseStrike(commander, npc, phaseId, phaseLabel, log);
    if (endedByCommanderStrike || commander.outcome || npc.outcome) return true;

    const endedByNpcStrike = resolvePhaseStrike(npc, commander, phaseId, phaseLabel, log);
    return endedByNpcStrike || Boolean(commander.outcome || npc.outcome);
}

function runInfantryPhase(commander, npc, log) {
    log.push('— Phase 4 — Infantry Engagement —');

    let roundsPlayed = 0;
    for (let round = 1; round <= INFANTRY_MAX_ROUNDS; round += 1) {
        if (commander.outcome || npc.outcome) break;

        const commanderLane = commander.lanes.infantry;
        const npcLane = npc.lanes.infantry;

        if (!commanderLane.attack && !npcLane.attack) {
            log.push('No infantry remaining on either side — phase skipped.');
            break;
        }

        roundsPlayed = round;
        log.push(`Infantry round ${round}:`);

        if (commanderLane.attack) {
            resolvePhaseStrike(commander, npc, 'infantry', `Infantry ${round}`, log);
        }
        if (!npc.outcome && !commander.outcome && npcLane.attack) {
            resolvePhaseStrike(npc, commander, 'infantry', `Infantry ${round}`, log);
        }

        evaluateArmyOutcome(commander);
        evaluateArmyOutcome(npc);

        if (commander.outcome || npc.outcome) break;

        log.push(`After round ${round}: You — ${formatArmyStatus(commander)} · NPC — ${formatArmyStatus(npc)}.`);
    }

    return roundsPlayed;
}

function buildForceSummary(army) {
    return {
        hp: Math.max(0, Math.floor(army.startingHp)),
        hpRemaining: Math.max(0, Math.floor(army.currentHp)),
        units: Math.max(0, army.startingUnits),
        unitsRemaining: Math.max(0, army.currentUnits),
        morale: Math.max(0, army.morale),
        stacks: army.stacks,
        outcome: army.outcome,
        outcomeDetail: army.outcomeDetail
    };
}

function simulateTrainingBattle(attackerStacks, defenderStacks, catalog, trainingMode = 'street-patrol') {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const commander = buildBattleArmy('You', attackerStacks, catalogRef);
    const npc = buildBattleArmy('Training Host', defenderStacks, catalogRef);
    const modeLabel = TRAINING_MODE_LABELS[trainingMode] || 'Guild Training';
    const log = [`Adventurer's Guild — ${modeLabel} engagement initiated.`];

    if (!commander.startingHp || !npc.startingHp) {
        return {
            ok: false,
            errorCode: 'NEXUS-AGE-017',
            log: ['Training battle requires units on both sides.']
        };
    }

    log.push(`Your force: ${formatArmyStatus(commander)} · ${commander.stacks.length} stack(s).`);
    log.push(`NPC host: ${formatArmyStatus(npc)} · ${npc.stacks.length} stack(s).`);

    let battleEndedEarly = false;

    for (const phase of BATTLE_PHASES) {
        battleEndedEarly = runBattlePhaseExchange(commander, npc, phase.id, phase.label, log);
        if (battleEndedEarly) break;
    }

    let infantryRounds = 0;
    if (!battleEndedEarly && !commander.outcome && !npc.outcome) {
        infantryRounds = runInfantryPhase(commander, npc, log);
    }

    evaluateArmyOutcome(commander);
    evaluateArmyOutcome(npc);

    const { winner, endReason } = resolveBattleWinner(commander, npc);
    const phasesCompleted = BATTLE_PHASES.length + (infantryRounds > 0 ? 1 : 0);

    if (winner === 'commander') {
        if (endReason === 'annihilation') {
            log.push('RESULT: Victory by annihilation — the training host is destroyed.');
        } else if (endReason === 'routing') {
            log.push('RESULT: Victory — the training host breaks and routes.');
        } else {
            log.push('RESULT: Victory — your infantry holds the field.');
        }
    } else if (winner === 'npc') {
        if (endReason === 'annihilation') {
            log.push('RESULT: Defeat by annihilation — your army is wiped out.');
        } else if (endReason === 'routing') {
            log.push('RESULT: Defeat — morale breaks and your units rout.');
        } else {
            log.push('RESULT: Defeat — the training host drives your line back.');
        }
    } else {
        log.push('RESULT: Draw — both armies withdraw.');
    }

    return {
        ok: true,
        winner,
        endReason,
        phasesCompleted,
        infantryRounds,
        roundsPlayed: BATTLE_PHASES.length + infantryRounds,
        commanderHpRemaining: Math.max(0, Math.floor(commander.currentHp)),
        npcHpRemaining: Math.max(0, Math.floor(npc.currentHp)),
        commanderMorale: Math.max(0, commander.morale),
        npcMorale: Math.max(0, npc.morale),
        commanderUnitsRemaining: Math.max(0, commander.currentUnits),
        npcUnitsRemaining: Math.max(0, npc.currentUnits),
        commanderOutcome: commander.outcome,
        npcOutcome: npc.outcome,
        commanderForce: buildForceSummary(commander),
        npcForce: buildForceSummary(npc),
        log
    };
}

const TRAINING_MODE_NPC_SCALE = Object.freeze({
    'street-patrol': 0.85,
    'civilian-transport': 1,
    'border-patrol': 1.2
});

const TRAINING_MODE_LABELS = Object.freeze({
    'street-patrol': 'Street Patrol',
    'civilian-transport': 'Civilian Transport',
    'border-patrol': 'Border Patrol'
});

function buildTrainingNpcArmy(catalog, templateStacks, trainingMode = 'street-patrol') {
    const scale = TRAINING_MODE_NPC_SCALE[trainingMode] || TRAINING_MODE_NPC_SCALE['street-patrol'];
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const template = Array.isArray(templateStacks) && templateStacks.length
        ? templateStacks
        : DEFAULT_TRAINING_NPC_STACKS;

    return template.map((entry) => {
        const catalogUnit = getCatalogUnitById(catalogRef, entry.catalogUnitId);
        const firstPromotion = Array.isArray(catalogUnit?.promotions) && catalogUnit.promotions.length
            ? catalogUnit.promotions[0]
            : 'app';
        const rankMap = { app: 1, std: 2, vet: 3, mst: 4, leg: 5, elite: 6 };

        return {
            catalogUnitId: entry.catalogUnitId,
            class: catalogUnit?.combatType || 'PHYS_INF',
            name: catalogUnit?.name || entry.catalogUnitId,
            tier: catalogUnit?.tier || 1,
            rank: rankMap[firstPromotion] || 1,
            qty: Math.max(1, Math.floor(Math.max(1, Math.floor(Number(entry.qty) || 1)) * scale)),
            injuredQty: 0,
            purpose: 'training'
        };
    });
}

function buildHealthyBattleStacks(army) {
    return normalizeAgeArmy(army).map((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack?.injuredQty) || 0)));
        const healthy = Math.max(0, qty - injured);
        if (!healthy) return null;
        return { ...stack, qty: healthy, injuredQty: 0 };
    }).filter(Boolean);
}

function executeGuildTrainingBattle(commander, trainingMode = 'street-patrol') {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const battleStacks = buildHealthyBattleStacks(army);
    const totalUnits = battleStacks.reduce((sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)), 0);

    if (!totalUnits) {
        return { ok: false, errorCode: 'NEXUS-AGE-017' };
    }

    const mode = TRAINING_MODE_LABELS[trainingMode] ? trainingMode : 'street-patrol';
    const npcArmy = buildTrainingNpcArmy(catalog, undefined, mode);
    const battle = simulateTrainingBattle(battleStacks, npcArmy, catalog, mode);
    if (!battle.ok) return battle;

    return {
        ok: true,
        trainingMode: mode,
        trainingModeLabel: TRAINING_MODE_LABELS[mode] || 'Training',
        ...battle,
        commanderUnits: totalUnits,
        npcUnits: npcArmy.reduce((sum, stack) => sum + stack.qty, 0)
    };
}

module.exports = {
    BATTLE_PHASES,
    INFANTRY_MAX_ROUNDS,
    DEFAULT_TRAINING_NPC_STACKS,
    TRAINING_MODE_NPC_SCALE,
    TRAINING_MODE_LABELS,
    buildBattleArmy,
    buildTrainingNpcArmy,
    simulateTrainingBattle,
    executeGuildTrainingBattle
};

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
    { catalogUnitId: 'recruit-shieldman-a', qty: 3, rank: 1 },
    { catalogUnitId: 'levy-archer-b', qty: 2, rank: 1 },
    { catalogUnitId: 'squire-rider', qty: 2, rank: 1 },
    { catalogUnitId: 'wild-wolf-a', qty: 2, rank: 1 },
    { catalogUnitId: 'acolyte', qty: 2, rank: 1 }
];

/** Hard cap — training spars use a small squad, not a garrison. */
const TRAINING_NPC_MAX_UNITS = 35;

/** Target NPC headcount by commander rank (interpolated). Quality scales via tier + stack rank. */
const TRAINING_NPC_TOTAL_ANCHORS = [
    { rank: 1, total: 11 },
    { rank: 7, total: 20 },
    { rank: 10, total: 24 },
    { rank: 14, total: 29 },
    { rank: 18, total: 33 },
    { rank: 22, total: 35 }
];

/**
 * Gradual NPC escalation keyed to commander rank (1–22).
 * `weight` controls composition mix; qty is derived from target total (never above TRAINING_NPC_MAX_UNITS).
 */
const TRAINING_NPC_RANK_BANDS = [
    {
        minCommanderRank: 1,
        maxCommanderRank: 6,
        stacks: [
            { catalogUnitId: 'recruit-shieldman-a', weight: 3, rank: 1, peakRank: 2 },
            { catalogUnitId: 'levy-archer-b', weight: 2, rank: 1, peakRank: 2 },
            { catalogUnitId: 'squire-rider', weight: 2, rank: 1, peakRank: 2 },
            { catalogUnitId: 'wild-wolf-a', weight: 2, rank: 1, peakRank: 2 },
            { catalogUnitId: 'acolyte', weight: 2, rank: 1, peakRank: 2 }
        ]
    },
    {
        minCommanderRank: 7,
        maxCommanderRank: 9,
        stacks: [
            { catalogUnitId: 'shield-sergeant-a', weight: 4, rank: 2, peakRank: 3 },
            { catalogUnitId: 'longbowman-b', weight: 3, rank: 2, peakRank: 3 },
            { catalogUnitId: 'royal-lancer', weight: 3, rank: 2, peakRank: 3 },
            { catalogUnitId: 'trained-wolf-a1', weight: 3, rank: 2, peakRank: 3 },
            { catalogUnitId: 'spellblade-b', weight: 3, rank: 2, peakRank: 3 },
            { catalogUnitId: 'holder', weight: 2, rank: 2, peakRank: 3 }
        ]
    },
    {
        minCommanderRank: 10,
        maxCommanderRank: 13,
        stacks: [
            { catalogUnitId: 'vanguard-axeman-b', weight: 4, rank: 3, peakRank: 4 },
            { catalogUnitId: 'sylvan-sniper-b', weight: 3, rank: 3, peakRank: 4 },
            { catalogUnitId: 'dread-knight', weight: 3, rank: 3, peakRank: 4 },
            { catalogUnitId: 'war-howler-a2', weight: 3, rank: 3, peakRank: 4 },
            { catalogUnitId: 'warder-a', weight: 3, rank: 3, peakRank: 4 },
            { catalogUnitId: 'holder', weight: 2, rank: 3, peakRank: 4 }
        ]
    },
    {
        minCommanderRank: 14,
        maxCommanderRank: 17,
        stacks: [
            { catalogUnitId: 'bulwark-guard-a', weight: 4, rank: 4, peakRank: 5 },
            { catalogUnitId: 'sylvan-sniper-b', weight: 3, rank: 4, peakRank: 5 },
            { catalogUnitId: 'dread-knight', weight: 3, rank: 4, peakRank: 5 },
            { catalogUnitId: 'steeljaw-a1', weight: 3, rank: 4, peakRank: 5 },
            { catalogUnitId: 'arcane-sentinel-a', weight: 3, rank: 4, peakRank: 5 },
            { catalogUnitId: 'citadel-guardian-a', weight: 2, rank: 5, peakRank: 6 }
        ]
    },
    {
        minCommanderRank: 18,
        maxCommanderRank: 22,
        stacks: [
            { catalogUnitId: 'citadel-guardian-a', weight: 4, rank: 5, peakRank: 6 },
            { catalogUnitId: 'frontline-breaker-b', weight: 3, rank: 5, peakRank: 6 },
            { catalogUnitId: 'dread-knight', weight: 3, rank: 5, peakRank: 6 },
            { catalogUnitId: 'voltgrime-a2', weight: 3, rank: 5, peakRank: 6 },
            { catalogUnitId: 'arcane-sentinel-a', weight: 3, rank: 5, peakRank: 6 },
            { catalogUnitId: 'holder', weight: 2, rank: 5, peakRank: 6 }
        ]
    }
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
    const npc = buildBattleArmy(resolveDefenderBattleLabel(trainingMode), defenderStacks, catalogRef);
    const log = [resolveBattleModeIntro(trainingMode)];

    if (!commander.startingHp || !npc.startingHp) {
        return {
            ok: false,
            errorCode: 'NEXUS-AGE-017',
            log: ['Training battle requires units on both sides.']
        };
    }

    log.push(`Your force: ${formatArmyStatus(commander)} · ${commander.stacks.length} stack(s).`);
    log.push(`${resolveDefenderBattleLabel(trainingMode)}: ${formatArmyStatus(npc)} · ${npc.stacks.length} stack(s).`);

    const phaseParticipation = {
        ranged: false,
        beasts: false,
        cavalry: false,
        infantryRounds: 0
    };

    let battleEndedEarly = false;

    for (const phase of BATTLE_PHASES) {
        phaseParticipation[phase.id] = true;
        battleEndedEarly = runBattlePhaseExchange(commander, npc, phase.id, phase.label, log);
        if (battleEndedEarly) break;
    }

    let infantryRounds = 0;
    if (!battleEndedEarly && !commander.outcome && !npc.outcome) {
        infantryRounds = runInfantryPhase(commander, npc, log);
        phaseParticipation.infantryRounds = infantryRounds;
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
        roundsPlayed: BATTLE_PHASES.filter((phase) => phaseParticipation[phase.id]).length + infantryRounds,
        phaseParticipation,
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
    'street-patrol': 0.78,
    'civilian-transport': 1,
    'border-patrol': 1.18
});

const TRAINING_MODE_LABELS = Object.freeze({
    'street-patrol': 'Street Patrol',
    'civilian-transport': 'Civilian Transport',
    'border-patrol': 'Border Patrol',
    'city-assault': 'City Assault',
    'city-defense': 'City Defense'
});

const BATTLE_MODE_LABELS = Object.freeze({
    ...TRAINING_MODE_LABELS
});

function resolveBattleModeIntro(trainingMode) {
    const mode = String(trainingMode || '').trim().toLowerCase();
    if (mode.startsWith('city-')) {
        const label = BATTLE_MODE_LABELS[mode] || 'City Battle';
        return `City battle — ${label} commenced.`;
    }
    const label = TRAINING_MODE_LABELS[mode] || 'Guild Training';
    return `Adventurer's Guild — ${label} engagement initiated.`;
}

function resolveDefenderBattleLabel(trainingMode) {
    const mode = String(trainingMode || '').trim().toLowerCase();
    return mode.startsWith('city-') ? 'City garrison' : 'Training Host';
}

function resolveCommanderTrainingRank(commanderRank) {
    return Math.max(1, Math.min(22, Math.floor(Number(commanderRank) || 1)));
}

function lerpTrainingNumber(from, to, t) {
    return from + ((to - from) * t);
}

function resolveTrainingNpcTargetTotal(commanderRank) {
    const rank = resolveCommanderTrainingRank(commanderRank);
    if (rank <= TRAINING_NPC_TOTAL_ANCHORS[0].rank) {
        return TRAINING_NPC_TOTAL_ANCHORS[0].total;
    }
    for (let index = 0; index < TRAINING_NPC_TOTAL_ANCHORS.length - 1; index += 1) {
        const lo = TRAINING_NPC_TOTAL_ANCHORS[index];
        const hi = TRAINING_NPC_TOTAL_ANCHORS[index + 1];
        if (rank <= hi.rank) {
            const span = hi.rank - lo.rank;
            const t = span > 0 ? (rank - lo.rank) / span : 0;
            return Math.round(lerpTrainingNumber(lo.total, hi.total, t));
        }
    }
    return TRAINING_NPC_TOTAL_ANCHORS[TRAINING_NPC_TOTAL_ANCHORS.length - 1].total;
}

function resolveTrainingNpcRankBand(commanderRank) {
    const rank = resolveCommanderTrainingRank(commanderRank);
    let band = TRAINING_NPC_RANK_BANDS[0];
    TRAINING_NPC_RANK_BANDS.forEach((entry) => {
        if (rank >= entry.minCommanderRank) band = entry;
    });
    return band;
}

function resolveTrainingStackRank(entry, commanderRank, band) {
    const rank = resolveCommanderTrainingRank(commanderRank);
    const baseRank = Math.max(1, Math.min(6, Math.floor(Number(entry.rank) || 1)));
    const peakRank = Math.max(baseRank, Math.min(6, Math.floor(Number(entry.peakRank) || baseRank)));
    const bandMin = band.minCommanderRank;
    const bandMax = band.maxCommanderRank || bandMin;
    const span = Math.max(1, bandMax - bandMin);
    const t = Math.max(0, Math.min(1, (rank - bandMin) / span));
    return Math.max(1, Math.min(6, Math.round(lerpTrainingNumber(baseRank, peakRank, t))));
}

function distributeTrainingNpcQuantities(stacks, targetTotal) {
    const total = Math.max(1, Math.min(TRAINING_NPC_MAX_UNITS, Math.floor(Number(targetTotal) || 1)));
    if (!stacks.length) return [];

    const weights = stacks.map((entry) => Math.max(1, Math.floor(Number(entry.weight ?? entry.qty) || 1)));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const exact = weights.map((weight) => (total * weight) / weightSum);
    const quantities = exact.map((value) => Math.floor(value));
    let remainder = total - quantities.reduce((sum, qty) => sum + qty, 0);

    const fractionalOrder = exact
        .map((value, index) => ({ index, fractional: value - Math.floor(value) }))
        .sort((left, right) => right.fractional - left.fractional);

    for (let step = 0; step < remainder; step += 1) {
        quantities[fractionalOrder[step % fractionalOrder.length].index] += 1;
    }

    return stacks
        .map((entry, index) => ({ entry, qty: quantities[index] }))
        .filter((row) => row.qty > 0);
}

function buildTrainingNpcArmy(catalog, templateStacks, trainingMode = 'street-patrol', commanderRank = 1) {
    const modeScale = TRAINING_MODE_NPC_SCALE[trainingMode] || TRAINING_MODE_NPC_SCALE['street-patrol'];
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const rank = resolveCommanderTrainingRank(commanderRank);

    if (Array.isArray(templateStacks) && templateStacks.length) {
        const explicitTotal = templateStacks.reduce(
            (sum, entry) => sum + Math.max(1, Math.floor(Number(entry.qty) || 1)),
            0
        );
        const cappedTotal = Math.min(TRAINING_NPC_MAX_UNITS, explicitTotal);
        const scale = explicitTotal > cappedTotal ? cappedTotal / explicitTotal : 1;

        return templateStacks.map((entry) => {
            const catalogUnit = getCatalogUnitById(catalogRef, entry.catalogUnitId);
            const stackRank = Math.max(1, Math.min(6, Math.floor(Number(entry.rank) || 1)));
            const qty = Math.max(1, Math.floor((Number(entry.qty) || 1) * scale));

            return {
                catalogUnitId: entry.catalogUnitId,
                class: catalogUnit?.combatType || 'PHYS_INF',
                name: catalogUnit?.name || entry.catalogUnitId,
                tier: catalogUnit?.tier || 1,
                rank: stackRank,
                qty,
                injuredQty: 0,
                purpose: 'training'
            };
        });
    }

    const band = resolveTrainingNpcRankBand(rank);
    const targetTotal = Math.min(
        TRAINING_NPC_MAX_UNITS,
        Math.max(1, Math.round(resolveTrainingNpcTargetTotal(rank) * modeScale))
    );
    const distributed = distributeTrainingNpcQuantities(band.stacks, targetTotal);

    return distributed.map(({ entry, qty }) => {
        const catalogUnit = getCatalogUnitById(catalogRef, entry.catalogUnitId);
        const stackRank = resolveTrainingStackRank(entry, rank, band);

        return {
            catalogUnitId: entry.catalogUnitId,
            class: catalogUnit?.combatType || 'PHYS_INF',
            name: catalogUnit?.name || entry.catalogUnitId,
            tier: catalogUnit?.tier || 1,
            rank: stackRank,
            qty,
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
    const commanderRank = Math.max(1, Math.min(22, Math.floor(Number(commander?.rank) || 1)));
    const npcArmy = buildTrainingNpcArmy(catalog, undefined, mode, commanderRank);
    const battle = simulateTrainingBattle(battleStacks, npcArmy, catalog, mode);
    if (!battle.ok) return battle;

    return {
        ok: true,
        trainingMode: mode,
        trainingModeLabel: TRAINING_MODE_LABELS[mode] || 'Training',
        commanderRank,
        ...battle,
        commanderUnits: totalUnits,
        npcUnits: npcArmy.reduce((sum, stack) => sum + stack.qty, 0)
    };
}

module.exports = {
    BATTLE_PHASES,
    INFANTRY_MAX_ROUNDS,
    DEFAULT_TRAINING_NPC_STACKS,
    TRAINING_NPC_MAX_UNITS,
    TRAINING_MODE_NPC_SCALE,
    TRAINING_MODE_LABELS,
    TRAINING_NPC_RANK_BANDS,
    resolveTrainingNpcTargetTotal,
    buildBattleArmy,
    buildTrainingNpcArmy,
    simulateTrainingBattle,
    executeGuildTrainingBattle
};

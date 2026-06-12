/**
 * NEXUS — Watchtower border intel: garrison spy fragments, compiler, player scouts, seize PvP.
 */
'use strict';

const { loadUnitPurchaseCatalog, getCatalogUnitById, resolveCommanderAgeGold } = require('./nexus-age-recruitment');
const { resolveCommanderAgeArmy, normalizeAgeArmy } = require('./nexus-age-roster');
const { simulateTrainingBattle } = require('./nexus-age-battle-sim');
const {
    buildCityGarrisonArmy,
    buildHealthyBattleStacks,
    normalizePlayersInCityCount
} = require('./nexus-age-city-battle');
const {
    distributeInjuriesWeighted,
    resolveCommanderInjuryMitigation,
    resolveBattleInjuryCount,
    applyGuildRankXp
} = require('./nexus-age-guild');
const { calculatePvpBattleGuildXp, appendPvpBattleXpLogLines } = require('./nexus-age-guild-xp');
const { buildBattleArmy } = require('./nexus-age-battle-sim');
const { buildCommanderRankMeta } = require('./nexus-commander-rank-titles');
const { computeArmyPowerScore } = require('./nexus-age-hq-intel');

const SCOUT_GOLD_COST = 150;
const BORDER_PVP_MODE = 'border-pvp';
const GARRISON_SECTION_KEYS = Object.freeze([
    'player_presence',
    'npc_garrison',
    'player_army_totals',
    'unit_tiers',
    'combined_strength'
]);
const FRAGMENT_MAX_PER_CITY = 24;
const COMPILED_MAX_PER_CITY = 6;
const PLAYER_SCOUT_MAX_PER_TARGET = 8;

function normalizeUsername(value) {
    return String(value || '').trim();
}

function createWatchtowerId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashSeed(input) {
    const text = String(input || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function clampAccuracy(value) {
    return Math.max(0.22, Math.min(0.94, Math.round(value * 100) / 100));
}

function applyEstimateNoise(trueValue, accuracy, seedSuffix = '') {
    const base = Math.max(0, Number(trueValue) || 0);
    if (!base) return 0;
    const spread = 1 - clampAccuracy(accuracy);
    const seed = hashSeed(`${base}:${seedSuffix}`);
    const variance = spread * 0.55;
    const factor = 1 + (((seed % 200) / 100) - 1) * variance;
    return Math.max(0, Math.round(base * factor));
}

function getDefaultWatchtowerState() {
    return {
        garrisonFragments: [],
        compiledReports: [],
        garrisonSpies: {},
        playerScouts: {}
    };
}

function normalizeGarrisonFragment(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    const cityId = String(raw.cityId || '').trim().slice(0, 64);
    const sectionKey = String(raw.sectionKey || '').trim();
    if (!id || !cityId || !GARRISON_SECTION_KEYS.includes(sectionKey)) return null;
    return {
        id,
        cityId,
        cityName: String(raw.cityName || '').trim().slice(0, 80),
        createdBy: normalizeUsername(raw.createdBy),
        createdAt: String(raw.createdAt || '').trim() || new Date().toISOString(),
        sectionKey,
        accuracy: clampAccuracy(Number(raw.accuracy) || 0.55),
        data: raw.data && typeof raw.data === 'object' ? raw.data : {}
    };
}

function normalizeCompiledReport(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    const cityId = String(raw.cityId || '').trim().slice(0, 64);
    if (!id || !cityId) return null;
    return {
        id,
        cityId,
        cityName: String(raw.cityName || '').trim().slice(0, 80),
        createdBy: normalizeUsername(raw.createdBy),
        createdAt: String(raw.createdAt || '').trim() || new Date().toISOString(),
        contributorCount: Math.max(1, Math.floor(Number(raw.contributorCount) || 1)),
        accuracy: clampAccuracy(Number(raw.accuracy) || 0.7),
        sections: raw.sections && typeof raw.sections === 'object' ? raw.sections : {},
        fragmentIds: Array.isArray(raw.fragmentIds)
            ? raw.fragmentIds.map((row) => String(row || '').trim()).filter(Boolean).slice(0, 48)
            : []
    };
}

function normalizePlayerScoutEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    const targetUsername = normalizeUsername(raw.targetUsername);
    if (!id || !targetUsername) return null;
    return {
        id,
        cityId: String(raw.cityId || '').trim().slice(0, 64),
        targetUsername,
        createdBy: normalizeUsername(raw.createdBy),
        createdAt: String(raw.createdAt || '').trim() || new Date().toISOString(),
        accuracy: clampAccuracy(Number(raw.accuracy) || 0.38),
        estimate: raw.estimate && typeof raw.estimate === 'object' ? raw.estimate : {}
    };
}

function normalizeWatchtowerState(raw) {
    const base = getDefaultWatchtowerState();
    if (!raw || typeof raw !== 'object') return base;

    const garrisonSpies = {};
    if (raw.garrisonSpies && typeof raw.garrisonSpies === 'object') {
        Object.keys(raw.garrisonSpies).forEach((cityId) => {
            const cityKey = String(cityId || '').trim();
            const cityRow = raw.garrisonSpies[cityId];
            if (!cityKey || !cityRow || typeof cityRow !== 'object') return;
            garrisonSpies[cityKey] = {};
            Object.keys(cityRow).forEach((usernameKey) => {
                const username = normalizeUsername(usernameKey);
                const entry = cityRow[usernameKey];
                if (!username || !entry || typeof entry !== 'object') return;
                garrisonSpies[cityKey][username.toLowerCase()] = {
                    at: String(entry.at || '').trim() || null,
                    fragmentId: String(entry.fragmentId || '').trim() || null
                };
            });
        });
    }

    const playerScouts = {};
    if (raw.playerScouts && typeof raw.playerScouts === 'object') {
        Object.keys(raw.playerScouts).forEach((cityId) => {
            const cityKey = String(cityId || '').trim();
            const cityRow = raw.playerScouts[cityId];
            if (!cityKey || !cityRow || typeof cityRow !== 'object') return;
            playerScouts[cityKey] = {};
            Object.keys(cityRow).forEach((targetKey) => {
                const target = normalizeUsername(targetKey);
                const list = Array.isArray(cityRow[targetKey]) ? cityRow[targetKey] : [];
                if (!target) return;
                playerScouts[cityKey][target.toLowerCase()] = list
                    .map(normalizePlayerScoutEntry)
                    .filter(Boolean)
                    .slice(0, PLAYER_SCOUT_MAX_PER_TARGET);
            });
        });
    }

    return {
        garrisonFragments: (Array.isArray(raw.garrisonFragments) ? raw.garrisonFragments : [])
            .map(normalizeGarrisonFragment)
            .filter(Boolean)
            .slice(0, 120),
        compiledReports: (Array.isArray(raw.compiledReports) ? raw.compiledReports : [])
            .map(normalizeCompiledReport)
            .filter(Boolean)
            .slice(0, 48),
        garrisonSpies,
        playerScouts
    };
}

function averageCommanderRank(commanders) {
    const list = Array.isArray(commanders) ? commanders.filter(Boolean) : [];
    if (!list.length) return 1;
    const sum = list.reduce((total, commander) => (
        total + Math.max(1, Math.floor(Number(buildCommanderRankMeta(commander).rank) || 1))
    ), 0);
    return Math.max(1, Math.round(sum / list.length));
}

function aggregateArmyStacks(commanders) {
    const merged = new Map();
    (commanders || []).forEach((commander) => {
        resolveCommanderAgeArmy(commander).forEach((stack) => {
            const key = String(stack.catalogUnitId || stack.name || stack.class || 'unit').trim().toLowerCase();
            if (!key) return;
            const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
            const tier = Math.max(1, Math.floor(Number(stack?.tier) || 1));
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, {
                    catalogUnitId: stack.catalogUnitId || key,
                    displayName: String(stack.name || stack.class || key).trim(),
                    totalQty: qty,
                    tierSum: tier * qty,
                    tierQty: qty
                });
                return;
            }
            existing.totalQty += qty;
            existing.tierSum += tier * qty;
            existing.tierQty += qty;
        });
    });
    return [...merged.values()].map((row) => ({
        ...row,
        avgTier: row.tierQty > 0 ? Math.round((row.tierSum / row.tierQty) * 10) / 10 : 1
    }));
}

function summarizeStacksForce(stacks, catalog) {
    const army = normalizeAgeArmy(stacks);
    const healthy = buildHealthyBattleStacks(army);
    const battleArmy = buildBattleArmy('watchtower', healthy, catalog);
    const units = healthy.reduce(
        (sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)),
        0
    );
    return {
        units,
        hp: Math.max(0, Math.round(Number(battleArmy?.startingHp) || 0)),
        stackCount: healthy.length
    };
}

function buildTrueGarrisonIntel(city, commandersInCity, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const players = (commandersInCity || []).filter((commander) => normalizeUsername(commander?.username));
    const playerStacks = aggregateArmyStacks(players);
    const playerForce = summarizeStacksForce(
        players.flatMap((commander) => resolveCommanderAgeArmy(commander)),
        catalogRef
    );
    const avgRank = averageCommanderRank(players);
    const comrades = normalizePlayersInCityCount(players.length || 1);
    const npcArmy = buildCityGarrisonArmy(catalogRef, avgRank, city, comrades);
    const npcForce = summarizeStacksForce(npcArmy, catalogRef);
    const npcStacks = aggregateArmyStacks([{ username: 'npc', ageArmy: npcArmy }]);

    const unitTypeMap = new Map();
    playerStacks.forEach((row) => {
        unitTypeMap.set(String(row.catalogUnitId).toLowerCase(), {
            catalogUnitId: row.catalogUnitId,
            displayName: row.displayName,
            playerQty: row.totalQty,
            npcQty: 0,
            avgTier: row.avgTier
        });
    });
    npcStacks.forEach((row) => {
        const key = String(row.catalogUnitId).toLowerCase();
        const existing = unitTypeMap.get(key);
        if (existing) {
            existing.npcQty = row.totalQty;
            existing.avgTier = existing.playerQty > 0
                ? Math.round(((existing.avgTier * existing.playerQty) + (row.avgTier * row.totalQty))
                    / (existing.playerQty + row.totalQty) * 10) / 10
                : row.avgTier;
            return;
        }
        unitTypeMap.set(key, {
            catalogUnitId: row.catalogUnitId,
            displayName: row.displayName,
            playerQty: 0,
            npcQty: row.totalQty,
            avgTier: row.avgTier
        });
    });

    const unitTypes = [...unitTypeMap.values()]
        .map((row) => ({
            ...row,
            totalQty: row.playerQty + row.npcQty
        }))
        .sort((left, right) => right.totalQty - left.totalQty);

    return {
        playerCount: players.length,
        playerUsernames: players.map((commander) => normalizeUsername(commander.username)),
        playerTotalUnits: playerForce.units,
        playerTotalHp: playerForce.hp,
        npcTotalUnits: npcForce.units,
        npcTotalHp: npcForce.hp,
        combinedTotalUnits: playerForce.units + npcForce.units,
        combinedTotalHp: playerForce.hp + npcForce.hp,
        unitTypes
    };
}

function pickGarrisonSectionsForSpy(username, cityId) {
    const seed = hashSeed(`${username}:${cityId}`);
    const primary = GARRISON_SECTION_KEYS[seed % GARRISON_SECTION_KEYS.length];
    const secondary = GARRISON_SECTION_KEYS[(seed + 2) % GARRISON_SECTION_KEYS.length];
    return primary === secondary ? [primary] : [primary, secondary];
}

function buildSectionPayload(sectionKey, trueIntel, accuracy, seedSuffix) {
    switch (sectionKey) {
        case 'player_presence':
            return {
                label: 'Garrisoned commanders',
                estimatedCount: applyEstimateNoise(trueIntel.playerCount, accuracy, `${seedSuffix}:presence`),
                note: 'Includes active players currently stationed in this city.'
            };
        case 'npc_garrison':
            return {
                label: 'NPC garrison',
                estimatedUnits: applyEstimateNoise(trueIntel.npcTotalUnits, accuracy, `${seedSuffix}:npc-units`),
                estimatedHp: applyEstimateNoise(trueIntel.npcTotalHp, accuracy, `${seedSuffix}:npc-hp`),
                note: 'Settlement NPC defenders supporting the city wall.'
            };
        case 'player_army_totals':
            return {
                label: 'Player armies',
                estimatedUnits: applyEstimateNoise(trueIntel.playerTotalUnits, accuracy, `${seedSuffix}:player-units`),
                estimatedHp: applyEstimateNoise(trueIntel.playerTotalHp, accuracy, `${seedSuffix}:player-hp`),
                note: 'Combined standing armies of garrisoned commanders.'
            };
        case 'unit_tiers': {
            const picks = trueIntel.unitTypes.slice(0, 4).map((row, index) => ({
                unitName: row.displayName,
                estimatedQty: applyEstimateNoise(row.totalQty, accuracy, `${seedSuffix}:unit-${index}`),
                estimatedAvgTier: Math.max(
                    1,
                    Math.round(row.avgTier * (1 + (((hashSeed(`${seedSuffix}:tier-${index}`) % 40) - 20) / 100)) * 10) / 10
                ),
                includesNpc: row.npcQty > 0,
                includesPlayers: row.playerQty > 0
            }));
            return {
                label: 'Unit breakdown (partial)',
                units: picks,
                note: 'Estimated stacks drawn from garrisoned players and NPC defenders.'
            };
        }
        case 'combined_strength':
        default:
            return {
                label: 'Combined garrison strength',
                estimatedUnits: applyEstimateNoise(trueIntel.combinedTotalUnits, accuracy, `${seedSuffix}:combined-units`),
                estimatedHp: applyEstimateNoise(trueIntel.combinedTotalHp, accuracy, `${seedSuffix}:combined-hp`),
                note: 'Total defensive mass — players plus NPC garrison.'
            };
    }
}

function buildGarrisonSpyFragment(trueIntel, meta) {
    const username = normalizeUsername(meta?.createdBy);
    const cityId = String(meta?.cityId || '').trim();
    const accuracy = clampAccuracy(0.52 + (hashSeed(`${username}:${cityId}:acc`) % 12) / 100);
    const sectionKeys = pickGarrisonSectionsForSpy(username, cityId);
    const sections = {};
    sectionKeys.forEach((sectionKey) => {
        sections[sectionKey] = buildSectionPayload(sectionKey, trueIntel, accuracy, `${username}:${sectionKey}`);
    });

    return {
        id: createWatchtowerId('garrison-frag'),
        cityId,
        cityName: String(meta?.cityName || '').trim().slice(0, 80),
        createdBy: username,
        createdAt: new Date().toISOString(),
        sectionKey: sectionKeys[0],
        accuracy,
        data: {
            sectionKeys,
            sections
        }
    };
}

function hasGarrisonSpyForUser(watchtower, cityId, username) {
    const cityKey = String(cityId || '').trim();
    const userKey = normalizeUsername(username).toLowerCase();
    return Boolean(watchtower?.garrisonSpies?.[cityKey]?.[userKey]);
}

function listCityFragments(watchtower, cityId) {
    const cityKey = String(cityId || '').trim();
    return (watchtower?.garrisonFragments || []).filter((row) => row.cityId === cityKey);
}

function getLatestCompiledReport(watchtower, cityId) {
    const cityKey = String(cityId || '').trim();
    const reports = (watchtower?.compiledReports || []).filter((row) => row.cityId === cityKey);
    if (!reports.length) return null;
    return reports.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
}

function compileGarrisonFragments(watchtower, cityId, cityName, createdBy) {
    const fragments = listCityFragments(watchtower, cityId);
    if (!fragments.length) {
        return { errorCode: 'NEXUS-AGE-036' };
    }

    const contributors = new Set(fragments.map((row) => row.createdBy.toLowerCase()).filter(Boolean));
    const mergedSections = {};
    const fragmentIds = [];

    fragments.forEach((fragment) => {
        fragmentIds.push(fragment.id);
        const sections = fragment.data?.sections && typeof fragment.data.sections === 'object'
            ? fragment.data.sections
            : { [fragment.sectionKey]: fragment.data };
        Object.keys(sections).forEach((sectionKey) => {
            const existing = mergedSections[sectionKey];
            const candidate = {
                ...sections[sectionKey],
                accuracy: fragment.accuracy,
                source: fragment.createdBy
            };
            if (!existing || candidate.accuracy > existing.accuracy) {
                mergedSections[sectionKey] = candidate;
            }
        });
    });

    const accuracy = clampAccuracy(0.62 + Math.min(0.28, contributors.size * 0.07));
    const report = normalizeCompiledReport({
        id: createWatchtowerId('garrison-compiled'),
        cityId,
        cityName,
        createdBy: normalizeUsername(createdBy),
        createdAt: new Date().toISOString(),
        contributorCount: contributors.size,
        accuracy,
        sections: mergedSections,
        fragmentIds
    });

    const compiledReports = [
        report,
        ...(watchtower.compiledReports || []).filter((row) => row.cityId !== cityId || row.id !== report.id)
    ].slice(0, COMPILED_MAX_PER_CITY * 12);

    return {
        report,
        watchtower: {
            ...watchtower,
            compiledReports
        }
    };
}

function buildPlayerScoutEstimate(targetCommander, cityId) {
    const username = normalizeUsername(targetCommander?.username);
    const army = resolveCommanderAgeArmy(targetCommander);
    const catalog = loadUnitPurchaseCatalog();
    const healthy = buildHealthyBattleStacks(army);
    const force = summarizeStacksForce(healthy, catalog);
    const accuracy = clampAccuracy(0.34 + (hashSeed(`${username}:${cityId}:scout`) % 10) / 100);
    const stacks = aggregateArmyStacks([targetCommander]).slice(0, 5).map((row, index) => ({
        unitName: row.displayName,
        estimatedQty: applyEstimateNoise(row.totalQty, accuracy, `${username}:stack:${index}`),
        estimatedAvgTier: Math.max(
            1,
            Math.round(row.avgTier * (1 + (((hashSeed(`${username}:tier:${index}`) % 30) - 15) / 100)) * 10) / 10
        )
    }));

    return {
        id: createWatchtowerId('player-scout'),
        cityId: String(cityId || '').trim(),
        targetUsername: username,
        createdAt: new Date().toISOString(),
        accuracy,
        estimate: {
            estimatedUnits: applyEstimateNoise(force.units, accuracy, `${username}:units`),
            estimatedPower: applyEstimateNoise(computeArmyPowerScore(targetCommander), accuracy, `${username}:power`),
            estimatedStacks: stacks,
            note: 'Single-commander scout raid — less reliable than a compiled city garrison report.'
        }
    };
}

function appendGarrisonSpy(watchtower, fragment, username) {
    const cityKey = String(fragment.cityId || '').trim();
    const userKey = normalizeUsername(username).toLowerCase();
    if (hasGarrisonSpyForUser(watchtower, cityKey, userKey)) {
        return { errorCode: 'NEXUS-AGE-032' };
    }

    const cityFragments = listCityFragments(watchtower, cityKey);
    if (cityFragments.length >= FRAGMENT_MAX_PER_CITY) {
        return { errorCode: 'HQ_SPY_LOG_FULL' };
    }

    const garrisonSpies = { ...(watchtower.garrisonSpies || {}) };
    if (!garrisonSpies[cityKey]) garrisonSpies[cityKey] = {};
    garrisonSpies[cityKey][userKey] = {
        at: fragment.createdAt,
        fragmentId: fragment.id
    };

    return {
        fragment,
        watchtower: {
            ...watchtower,
            garrisonFragments: [fragment, ...(watchtower.garrisonFragments || [])].slice(0, 120),
            garrisonSpies
        }
    };
}

function appendPlayerScout(watchtower, scoutEntry, createdBy) {
    const cityKey = String(scoutEntry.cityId || '').trim();
    const targetKey = normalizeUsername(scoutEntry.targetUsername).toLowerCase();
    const playerScouts = { ...(watchtower.playerScouts || {}) };
    if (!playerScouts[cityKey]) playerScouts[cityKey] = {};
    const existing = Array.isArray(playerScouts[cityKey][targetKey]) ? playerScouts[cityKey][targetKey] : [];
    const entry = normalizePlayerScoutEntry({
        ...scoutEntry,
        createdBy: normalizeUsername(createdBy)
    });
    playerScouts[cityKey][targetKey] = [entry, ...existing].filter(Boolean).slice(0, PLAYER_SCOUT_MAX_PER_TARGET);

    return {
        scoutEntry: entry,
        watchtower: {
            ...watchtower,
            playerScouts
        }
    };
}

function buildWatchtowerWorkspacePayload(options) {
    const {
        city,
        cityId,
        players,
        watchtower,
        viewerUsername,
        viewerGold,
        canGarrisonSpy,
        relationship
    } = options;

    const fragments = listCityFragments(watchtower, cityId);
    const compiled = getLatestCompiledReport(watchtower, cityId);
    const viewerKey = normalizeUsername(viewerUsername).toLowerCase();
    const myFragment = fragments.find((row) => row.createdBy.toLowerCase() === viewerKey) || null;
    const cityScouts = watchtower?.playerScouts?.[cityId] || {};

    const playerRows = (players || []).map((player) => {
        const targetKey = normalizeUsername(player.username).toLowerCase();
        const scouts = Array.isArray(cityScouts[targetKey]) ? cityScouts[targetKey] : [];
        const myScout = scouts.find((row) => row.createdBy.toLowerCase() === viewerKey) || scouts[0] || null;
        return {
            ...player,
            canScout: !player.isSelf,
            canSeize: !player.isSelf && relationship === 'hostile',
            scoutReport: myScout
        };
    });

    return {
        cityId,
        cityName: city?.name || '',
        nationName: city?.nationName || '',
        relationship,
        scoutGoldCost: SCOUT_GOLD_COST,
        viewerGold,
        canGarrisonSpy,
        hasGarrisonSpy: !canGarrisonSpy,
        myGarrisonFragment: myFragment,
        garrisonFragments: fragments,
        compiledGarrisonReport: compiled,
        garrisonEstimate: compiled || (myFragment ? {
            accuracy: myFragment.accuracy,
            sections: myFragment.data?.sections || {},
            partial: true,
            contributorCount: 1
        } : null),
        players: playerRows,
        compilerReady: fragments.length >= 2,
        fragmentCount: fragments.length
    };
}

function applyCommanderBattleInjuries(commander, battle, profileMode) {
    const catalog = loadUnitPurchaseCatalog();
    const injuryCount = resolveBattleInjuryCount(commander, battle, profileMode, catalog);
    const preArmy = resolveCommanderAgeArmy(commander);
    const nextArmy = distributeInjuriesWeighted(preArmy, injuryCount, catalog);
    return {
        injuryCount,
        ageArmy: nextArmy
    };
}

function executeBorderSeizeBattle(attacker, defender) {
    const catalog = loadUnitPurchaseCatalog();
    const attackerStacks = buildHealthyBattleStacks(resolveCommanderAgeArmy(attacker));
    const defenderStacks = buildHealthyBattleStacks(resolveCommanderAgeArmy(defender));
    const attackerUnits = attackerStacks.reduce((sum, stack) => sum + stack.qty, 0);
    const defenderUnits = defenderStacks.reduce((sum, stack) => sum + stack.qty, 0);

    if (!attackerUnits) return { ok: false, errorCode: 'NEXUS-AGE-017' };
    if (!defenderUnits) return { ok: false, errorCode: 'NEXUS-AGE-034' };

    const battle = simulateTrainingBattle(attackerStacks, defenderStacks, catalog, BORDER_PVP_MODE, {
        attackerCommander: attacker,
        defenderCommander: defender
    });
    if (!battle.ok) return battle;

    const attackerInjuries = applyCommanderBattleInjuries(attacker, battle, BORDER_PVP_MODE);
    const defenderInjuries = applyCommanderBattleInjuries(defender, {
        ...battle,
        winner: battle.winner === 'commander' ? 'npc' : 'commander'
    }, BORDER_PVP_MODE);

    const attackerWon = battle.winner === 'commander';
    const attackerXpCalc = calculatePvpBattleGuildXp(battle, { pvpRole: 'attack' });
    const defenderXpCalc = calculatePvpBattleGuildXp({
        ...battle,
        winner: attackerWon ? 'npc' : 'commander'
    }, { pvpRole: 'defense' });

    if (Array.isArray(battle.log)) {
        appendPvpBattleXpLogLines(battle.log, attackerXpCalc);
    }

    const attackerXp = applyGuildRankXp(attacker, attackerXpCalc.xpGain);
    const defenderXp = applyGuildRankXp(defender, defenderXpCalc.xpGain);

    return {
        ok: true,
        battleRole: 'border-seize',
        trainingMode: BORDER_PVP_MODE,
        trainingModeLabel: 'Border Seize',
        attackerUsername: normalizeUsername(attacker?.username),
        defenderUsername: normalizeUsername(defender?.username),
        attackerWon,
        winner: attackerWon ? 'attacker' : 'defender',
        log: battle.log,
        attacker: {
            ageArmy: attackerInjuries.ageArmy,
            injuriesApplied: attackerInjuries.injuryCount,
            rank: attackerXp.rank,
            ageGuildXp: attackerXp.ageGuildXp,
            xpGain: attackerXpCalc.xpGain
        },
        defender: {
            ageArmy: defenderInjuries.ageArmy,
            injuriesApplied: defenderInjuries.injuryCount,
            rank: defenderXp.rank,
            ageGuildXp: defenderXp.ageGuildXp,
            xpGain: defenderXpCalc.xpGain
        }
    };
}

module.exports = {
    SCOUT_GOLD_COST,
    BORDER_PVP_MODE,
    GARRISON_SECTION_KEYS,
    getDefaultWatchtowerState,
    normalizeWatchtowerState,
    buildTrueGarrisonIntel,
    buildGarrisonSpyFragment,
    buildPlayerScoutEstimate,
    hasGarrisonSpyForUser,
    appendGarrisonSpy,
    appendPlayerScout,
    compileGarrisonFragments,
    buildWatchtowerWorkspacePayload,
    executeBorderSeizeBattle,
    listCityFragments,
    getLatestCompiledReport
};

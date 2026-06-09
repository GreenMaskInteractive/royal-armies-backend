/**
 * RIFT — Commander profile advisor for banner blessing & skill-tree paths.
 * Uses army composition plus rank, class, nation, settlement, and economy signals.
 */
(function initRoyalArmiesBannerArmyAdvisor(global) {
    'use strict';

    const LANE_IDS = ['ranged', 'beasts', 'cavalry', 'infantry'];
    const LANE_LABELS = Object.freeze({
        ranged: 'Ranged',
        beasts: 'Beasts',
        cavalry: 'Cavalry',
        infantry: 'Infantry'
    });
    const VALID_LANE_HP_THRESHOLD = 0.15;
    const PROMOTION_BY_RANK = Object.freeze({
        1: 'app',
        2: 'std',
        3: 'vet',
        4: 'mst',
        5: 'leg',
        6: 'elite'
    });
    const SETTLEMENT_TIER_RANK = Object.freeze({
        village: 1,
        town: 2,
        city: 3,
        citadel: 4,
        capital: 5
    });
    const BANNER_IDS = Object.freeze([
        'true-war',
        'emerald-barrier',
        'sachiels-blessing',
        'fortunes-gratitude'
    ]);
    const EMERALD_BRANCH_PATHS = Object.freeze({
        A: Object.freeze({
            rootId: 'eb-03',
            name: 'Phalanx Hold',
            playstyle: 'Battlefield bulwark',
            summary: 'Hold battle lines with mixed-unit defense, damage reduction, and siege stalemates.'
        }),
        B: Object.freeze({
            rootId: 'eb-13',
            name: 'Rampart Reserve',
            playstyle: 'Campaign sustain',
            summary: 'Stretch your gold, recover after losses, and keep your army funded on the map.'
        }),
        C: Object.freeze({
            rootId: 'eb-14',
            name: 'Sentinel Screen',
            playstyle: 'Screen & shield',
            summary: 'Misdirect enemy intel, march faster to allies, and hold your own defensive battles.'
        })
    });

    function capitalize(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    function resolveBattlePhaseLane(combatType) {
        const type = String(combatType || '').trim().toUpperCase();
        if (type.includes('_ART')) return 'ranged';
        if (type.includes('_BST')) return 'beasts';
        if (type.includes('_CAV')) return 'cavalry';
        return 'infantry';
    }

    function resolveClassId(path) {
        const raw = path || global.player?.path || '';
        const api = global.RoyalArmiesCommanderRankTitles;
        if (api?.resolveCommanderPathId) return api.resolveCommanderPathId(raw);
        // Fallback mirror of rift-commander-rank-titles.js (canonical).
        const code = String(raw).trim().toUpperCase();
        return code === 'MAG' || code === 'MAGIC' ? 'battlemage' : 'battlemaster';
    }

    function resolvePerk1Branch(player) {
        const raw = String(
            player?.ageClassPerkChoices?.perk1
            || player?.ageClassPerkChoices?.perk1Branch
            || player?.ageClassPerk1Branch
            || ''
        ).trim().toUpperCase();
        if (raw === 'A' || raw === 'BUFF' || raw === 'OFFENSE') return 'A';
        if (raw === 'B' || raw === 'COVER' || raw === 'DEFENSE') return 'B';
        return null;
    }

    function resolveStackUnit(catalog, stack) {
        const catalogApi = global.RoyalArmiesUnitPurchaseCatalog;
        const catalogUnitId = String(stack?.catalogUnitId || '').trim();
        if (catalogUnitId && catalogApi?.getUnitById) {
            return catalogApi.getUnitById(catalog, catalogUnitId);
        }

        const name = String(stack?.name || '').trim().toLowerCase();
        if (!name) return null;
        return (catalog?.units || []).find((unit) => String(unit.name || '').trim().toLowerCase() === name) || null;
    }

    function resolvePromotionKey(stack, catalogUnit) {
        const rank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
        if (PROMOTION_BY_RANK[rank] && catalogUnit?.stats?.[PROMOTION_BY_RANK[rank]]) {
            return PROMOTION_BY_RANK[rank];
        }
        const first = Array.isArray(catalogUnit?.promotions) && catalogUnit.promotions.length
            ? catalogUnit.promotions[0]
            : 'app';
        return first;
    }

    function resolveStackLaneHp(stack, catalogUnit) {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        if (!qty) return { laneId: null, hp: 0, qty: 0, injuredQty: 0 };

        const promoKey = resolvePromotionKey(stack, catalogUnit);
        const stats = catalogUnit?.stats?.[promoKey] || catalogUnit?.stats?.app || {};
        const hp = Math.max(1, Math.floor(Number(stats.hp) || 1));
        const combatType = String(catalogUnit?.combatType || stack?.class || 'PHYS_INF').trim().toUpperCase();
        const laneId = resolveBattlePhaseLane(combatType);
        const injuredQty = Math.max(0, Math.floor(Number(stack?.injuredQty) || 0));

        return { laneId, hp: hp * qty, qty, injuredQty };
    }

    function formatLaneList(laneIds) {
        return laneIds.map((id) => LANE_LABELS[id] || id).join(' & ');
    }

    function collectCommanderContext(playerOverride) {
        const player = playerOverride || global.player || {};
        const movement = global.RoyalArmiesAgeMovement;
        const cityId = movement?.getCatalogCityId?.() || '';
        const city = movement?.resolveCatalogCityRecord?.(cityId)
            || global.RoyalArmiesAgeWorldMap?.getCityById?.(cityId)
            || null;

        const settlementTier = String(city?.settlementTier || 'village').trim().toLowerCase();
        const classId = resolveClassId(player.path);
        const perk1Branch = resolvePerk1Branch(player);
        const rank = Math.max(1, Math.floor(Number(player.rank) || 1));
        const gameNation = String(
            player.gameNation
            || movement?.resolvePlayerNationId?.()
            || ''
        ).trim();
        const ageGold = Math.max(0, Math.floor(Number(player.ageGold) || 0));
        const ageProvisions = Math.max(0, Math.floor(Number(player.ageProvisions) || 0));
        const unitsTotal = Math.max(
            0,
            Math.floor(Number(movement?.getUnitsTotal?.() || player.unitsTotal) || 0)
        );
        const unitsUninjured = Math.max(
            0,
            Math.floor(Number(movement?.getUnitsUninjured?.() || unitsTotal) || 0)
        );

        return {
            rank,
            isNewCommander: rank <= 6,
            classId,
            classLabel: classId === 'battlemage' ? 'Battlemage' : 'Battlemaster',
            perk1Branch,
            perk1Style: perk1Branch === 'B' ? 'cover' : perk1Branch === 'A' ? 'buff' : 'unknown',
            prefersDefense: perk1Branch === 'B' || classId === 'battlemage',
            prefersOffense: perk1Branch === 'A' && classId === 'battlemaster',
            gameNation,
            hasNation: Boolean(gameNation),
            ageGold,
            ageProvisions,
            lowGold: ageGold < 400,
            lowProvisions: ageProvisions < 25,
            settlementTier,
            settlementTierRank: SETTLEMENT_TIER_RANK[settlementTier] || 1,
            isCapital: Boolean(city?.isCapital),
            catalogCityId: cityId,
            cityName: String(city?.name || '').trim(),
            movePoints: Number.isFinite(Number(movement?.getMovePoints?.()))
                ? Math.max(0, Math.floor(Number(movement.getMovePoints())))
                : null,
            unitsTotal,
            unitsUninjured,
            injuredFromHud: unitsTotal > 0 ? Math.max(0, unitsTotal - unitsUninjured) / unitsTotal : 0
        };
    }

    function analyzeArmyStacks(stacks, catalog) {
        const laneHp = { ranged: 0, beasts: 0, cavalry: 0, infantry: 0 };
        const laneUnits = { ranged: 0, beasts: 0, cavalry: 0, infantry: 0 };
        let totalUnits = 0;
        let injuredUnits = 0;

        (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
            const unit = resolveStackUnit(catalog, stack);
            const slice = resolveStackLaneHp(stack, unit);
            if (!slice.laneId || !slice.qty) return;

            laneHp[slice.laneId] += slice.hp;
            laneUnits[slice.laneId] += slice.qty;
            totalUnits += slice.qty;
            injuredUnits += slice.injuredQty;
        });

        const totalHp = Math.max(1, LANE_IDS.reduce((sum, laneId) => sum + laneHp[laneId], 0));
        const laneShares = {};
        LANE_IDS.forEach((laneId) => {
            laneShares[laneId] = laneHp[laneId] / totalHp;
        });

        const validActiveLanes = LANE_IDS.filter((laneId) => laneShares[laneId] >= VALID_LANE_HP_THRESHOLD);
        let archetype = 'mono';
        if (validActiveLanes.length === 2) archetype = 'dual';
        else if (validActiveLanes.length === 3) archetype = 'tri';
        else if (validActiveLanes.length >= 4) archetype = 'grand';

        const rankedLanes = [...LANE_IDS].sort((a, b) => laneHp[b] - laneHp[a]);
        const dominantLane = rankedLanes[0] || 'infantry';
        const injuredRatio = totalUnits > 0 ? injuredUnits / totalUnits : 0;

        return {
            totalUnits,
            injuredUnits,
            injuredRatio,
            totalHp,
            laneHp,
            laneUnits,
            laneShares,
            validActiveLanes,
            validActiveLaneCount: validActiveLanes.length,
            archetype,
            dominantLane,
            laneSummary: validActiveLanes.length
                ? formatLaneList(validActiveLanes)
                : LANE_LABELS[dominantLane]
        };
    }

    function buildProfileSignals(commander, army) {
        const signals = [];

        if (commander.isNewCommander) {
            signals.push(`Rank ${commander.rank} commander`);
        } else {
            signals.push(`Rank ${commander.rank}`);
        }

        if (commander.perk1Branch === 'B') {
            signals.push(`${commander.classLabel} · defensive perk`);
        } else if (commander.perk1Branch === 'A') {
            signals.push(`${commander.classLabel} · aggressive perk`);
        } else {
            signals.push(commander.classLabel);
        }

        if (army.totalUnits > 0) {
            signals.push(`${army.laneSummary} army`);
        } else if (commander.unitsTotal > 0) {
            signals.push(`${commander.unitsTotal} units on record`);
        } else {
            signals.push('Growing army');
        }

        if (commander.hasNation) {
            signals.push('Nation member');
        }

        if (commander.settlementTier) {
            signals.push(`${capitalize(commander.settlementTier)} home`);
        }

        const injurySignal = Math.max(army.injuredRatio, commander.injuredFromHud || 0);
        if (injurySignal >= 0.15) {
            signals.push('Injured troops');
        }

        if (commander.lowGold) {
            signals.push('Tight gold');
        }

        return signals;
    }

    function scoreBannerOptions(commander, army) {
        const scores = {
            'true-war': 0,
            'emerald-barrier': 0,
            'sachiels-blessing': 0,
            'fortunes-gratitude': 0
        };
        const reasons = {
            'true-war': [],
            'emerald-barrier': [],
            'sachiels-blessing': [],
            'fortunes-gratitude': []
        };

        const injuryRatio = Math.max(army.injuredRatio, commander.injuredFromHud || 0);

        if (army.totalUnits <= 0 && commander.unitsTotal <= 0) {
            scores['emerald-barrier'] += 50;
            reasons['emerald-barrier'].push('a safe starter while you build your first army');
        }

        if (injuryRatio >= 0.2) {
            scores['sachiels-blessing'] += 45;
            reasons['sachiels-blessing'].push('many injured troops need recovery');
        } else if (injuryRatio >= 0.1) {
            scores['sachiels-blessing'] += 20;
            reasons['sachiels-blessing'].push('some injured troops on hand');
        }

        if (army.archetype === 'mono' && army.laneShares.infantry >= 0.5) {
            scores['true-war'] += 38;
            reasons['true-war'].push('your army is built around Infantry');
        }

        if (army.dominantLane === 'cavalry' && commander.prefersOffense) {
            scores['true-war'] += 22;
            reasons['true-war'].push('aggressive Battlemaster cavalry focus');
        }

        if (army.archetype === 'dual' || army.archetype === 'tri' || army.archetype === 'grand') {
            scores['emerald-barrier'] += 32;
            reasons['emerald-barrier'].push(`you run a mixed ${army.laneSummary} army`);
        }

        if (commander.prefersDefense) {
            scores['emerald-barrier'] += 18;
            reasons['emerald-barrier'].push('your class perk leans defensive');
        }

        if (commander.prefersOffense && army.dominantLane !== 'infantry') {
            scores['true-war'] += 12;
            reasons['true-war'].push('your class perk leans aggressive');
        }

        if (commander.classId === 'battlemage') {
            scores['emerald-barrier'] += 12;
            reasons['emerald-barrier'].push('Battlemages benefit from balanced unit type defenses');
        }

        if (commander.isNewCommander) {
            scores['emerald-barrier'] += 20;
            reasons['emerald-barrier'].push('forgiving for newer commanders');
        }

        if (commander.hasNation && commander.settlementTierRank >= 2) {
            scores['emerald-barrier'] += 14;
            reasons['emerald-barrier'].push('you are rooted in a nation settlement');
        }

        if (commander.settlementTierRank >= 3 || commander.isCapital) {
            scores['emerald-barrier'] += 10;
            reasons['emerald-barrier'].push('city defense skills match your settlement');
        }

        if (commander.lowGold || commander.lowProvisions) {
            scores['fortunes-gratitude'] += 16;
            reasons['fortunes-gratitude'].push('extra gold and savings help early progression');
        }

        if (commander.rank >= 14 && !commander.isNewCommander) {
            scores['fortunes-gratitude'] += 12;
            reasons['fortunes-gratitude'].push('higher rank rewards economic banner value');
        }

        if (commander.rank >= 10 && army.totalUnits >= 12) {
            scores['true-war'] += 8;
            reasons['true-war'].push('your rank and army size support front-line fighting');
        }

        scores['emerald-barrier'] += 8;

        let bannerId = 'emerald-barrier';
        let best = -Infinity;
        BANNER_IDS.forEach((id) => {
            if (scores[id] > best) {
                best = scores[id];
                bannerId = id;
            }
        });

        const topReasons = reasons[bannerId].slice(0, 2);
        const reason = topReasons.length
            ? `Recommended because ${topReasons.join(' and ')}.`
            : 'A strong balanced choice for your current profile.';

        return { bannerId, reason, scores, reasons };
    }

    function shouldRecommendSentinelScreenBranch(commander, army) {
        if (!commander.hasNation) return false;
        if (commander.rank < 6) return false;
        if (army.archetype === 'mono' && army.dominantLane === 'infantry' && commander.prefersOffense) {
            return false;
        }
        if (commander.prefersDefense || commander.movePoints !== null && commander.movePoints <= 2) {
            return true;
        }
        return commander.rank >= 10;
    }

    function shouldRecommendRampartReserveBranch(commander, army) {
        if (commander.lowGold || commander.lowProvisions) return true;
        if (army.totalUnits >= 60 && commander.ageGold < 1200) return true;
        if (commander.isNewCommander && army.totalUnits >= 40) return true;
        if (commander.hasNation && commander.settlementTierRank <= 2 && commander.rank >= 6 && army.totalUnits >= 50) {
            return true;
        }
        return false;
    }

    function buildEmeraldPathResult(branchKey, path, reason) {
        const meta = EMERALD_BRANCH_PATHS[branchKey] || EMERALD_BRANCH_PATHS.A;
        return {
            branch: branchKey,
            branchLabel: meta.name,
            playstyle: meta.playstyle,
            pathSummary: meta.summary,
            path,
            reason
        };
    }

    function buildEmeraldPathPlan(commander, army) {
        const archetype = army?.archetype || 'mono';
        const dominantLane = army?.dominantLane || 'infantry';
        const siegeHome = commander.settlementTierRank >= 3 || commander.isCapital;

        if (shouldRecommendSentinelScreenBranch(commander, army)) {
            return buildEmeraldPathResult(
                'C',
                ['eb-01', 'eb-14', 'eb-17', 'eb-18', 'eb-23', 'eb-25'],
                commander.prefersDefense
                    ? 'You play defensively—Sentinel Screen strengthens your defensive battles, marches, and counter-intel.'
                    : 'You operate across your nation—Sentinel Screen helps you reposition, misdirect scouts, and defend your own fights.'
            );
        }

        if (shouldRecommendRampartReserveBranch(commander, army)) {
            return buildEmeraldPathResult(
                'B',
                ['eb-01', 'eb-13', 'eb-16'],
                commander.lowGold || commander.lowProvisions
                    ? 'Tight gold or provisions—Rampart Reserve sustains a long defensive stand.'
                    : 'Your growing army needs logistical fortification—Rampart Reserve keeps upkeep affordable.'
            );
        }

        if (siegeHome && commander.prefersDefense) {
            return buildEmeraldPathResult(
                'A',
                ['eb-01', 'eb-03', 'eb-06', 'eb-10', 'eb-11', 'eb-25'],
                `Your ${capitalize(commander.settlementTier)} and defensive perk suit Phalanx Hold defensive battles.`
            );
        }

        if (archetype === 'grand') {
            return buildEmeraldPathResult(
                'A',
                ['eb-01', 'eb-03', 'eb-06', 'eb-07', 'eb-11', 'eb-25'],
                `Your mixed ${army.laneSummary} army and ${commander.classLabel} path fit the full Phalanx Hold line.`
            );
        }

        if (archetype === 'tri') {
            return buildEmeraldPathResult(
                'A',
                ['eb-01', 'eb-03', 'eb-07', 'eb-11', 'eb-25'],
                `Three unit types (${army.laneSummary}) pair well with Phalanx Hold mixed-unit bonuses.`
            );
        }

        if (archetype === 'dual') {
            return buildEmeraldPathResult(
                'A',
                ['eb-01', 'eb-03', 'eb-07', 'eb-11', 'eb-25'],
                `Two unit types (${army.laneSummary}) get the most from Phalanx Hold foundation skills.`
            );
        }

        if (dominantLane === 'infantry') {
            const path = siegeHome
                ? ['eb-01', 'eb-03', 'eb-07', 'eb-09', 'eb-11', 'eb-25']
                : ['eb-01', 'eb-03', 'eb-07', 'eb-09', 'eb-11', 'eb-25'];
            return buildEmeraldPathResult(
                'A',
                path,
                commander.prefersOffense
                    ? 'Infantry-heavy armies can still fortify first, then win long infantry fights.'
                    : 'Infantry-heavy armies gain the most from Phalanx Hold defense and stalemate skills.'
            );
        }

        if (dominantLane === 'ranged') {
            return buildEmeraldPathResult(
                'A',
                siegeHome
                    ? ['eb-01', 'eb-03', 'eb-06', 'eb-10', 'eb-11']
                    : ['eb-01', 'eb-03', 'eb-06', 'eb-10'],
                'Ranged-heavy armies need Phalanx Hold protection in round 1 and strong siege defense at home.'
            );
        }

        if (dominantLane === 'cavalry' && commander.prefersOffense) {
            return buildEmeraldPathResult(
                'A',
                ['eb-01', 'eb-03', 'eb-04', 'eb-08', 'eb-11'],
                'Cavalry-focused armies benefit from Phalanx Hold Layered Deflection before pushing deeper.'
            );
        }

        return buildEmeraldPathResult(
            'A',
            ['eb-01', 'eb-03', 'eb-07', 'eb-11', 'eb-25'],
            `Your ${LANE_LABELS[dominantLane]} focus and ${commander.classLabel} profile start best on Phalanx Hold.`
        );
    }

    function recommendBanner(commander, army) {
        return scoreBannerOptions(commander, army);
    }

    function resolveNextRecommendedNode(pathPlan, unlockedIds, perkPoints, canUnlockNode) {
        const path = Array.isArray(pathPlan?.path) ? pathPlan.path : [];
        const unlocked = unlockedIds instanceof Set
            ? unlockedIds
            : new Set((unlockedIds || []).map((id) => String(id || '').trim()).filter(Boolean));

        for (const nodeId of path) {
            if (unlocked.has(nodeId)) continue;
            const gate = canUnlockNode ? canUnlockNode(nodeId, unlocked) : { ok: true, cost: 1 };
            const cost = Math.max(0, Math.floor(Number(gate.cost) || 0));
            const canAfford = Math.max(0, Math.floor(Number(perkPoints) || 0)) >= cost;
            return {
                nodeId,
                canAfford: canAfford && gate.ok !== false,
                canUnlock: gate.ok !== false,
                cost,
                isOnPath: true
            };
        }

        return null;
    }

    async function loadCatalog() {
        const catalogApi = global.RoyalArmiesUnitPurchaseCatalog;
        if (catalogApi?.loadCatalog) return catalogApi.loadCatalog();
        if (catalogApi?.getCachedCatalog?.()) return catalogApi.getCachedCatalog();
        return null;
    }

    async function analyzeArmy(options = {}) {
        const player = options.player || global.player || {};
        const stacks = Array.isArray(options.stacks)
            ? options.stacks
            : (player.ageArmy || player.army || []);
        const catalog = options.catalog || await loadCatalog();
        const commander = options.commander || collectCommanderContext(player);
        const army = analyzeArmyStacks(stacks, catalog);
        const bannerPick = scoreBannerOptions(commander, army);
        const emerald = buildEmeraldPathPlan(commander, army);
        const profileSignals = buildProfileSignals(commander, army);

        return {
            ...army,
            commander,
            profileSignals,
            profileSummary: profileSignals.join(' · '),
            recommendedBannerId: bannerPick.bannerId,
            recommendedBannerReason: bannerPick.reason,
            bannerScores: bannerPick.scores,
            emerald,
            analyzedAt: Date.now()
        };
    }

    async function refreshAndPersist(writeBannerState, readBannerState) {
        if (typeof readBannerState !== 'function' || typeof writeBannerState !== 'function') {
            return null;
        }

        try {
            const advisor = await analyzeArmy();
            const state = readBannerState();
            state.armyAdvisor = advisor;
            writeBannerState(state);
            global.dispatchEvent(new CustomEvent('royalarmies:banner-advisor-updated', {
                detail: { advisor, state }
            }));
            return advisor;
        } catch (_error) {
            return null;
        }
    }

    global.RoyalArmiesBannerAdvisor = Object.freeze({
        LANE_LABELS,
        collectCommanderContext,
        analyzeArmy,
        recommendBanner,
        buildEmeraldPathPlan,
        buildProfileSignals,
        resolveNextRecommendedNode,
        refreshAndPersist
    });
})(window);

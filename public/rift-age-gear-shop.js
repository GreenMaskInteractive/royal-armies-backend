/**
 * RIFT — Forge (Blacksmith) purchases & Armory gold upgrades for commander gear.
 */
(function initRoyalArmiesAgeGearShop(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-gear-shop-state';
    const EQUIPMENT_MIN_RANK = 2;

    const STAT_LABELS = Object.freeze({
        strength: 'Strength',
        ranged: 'Ranged',
        morale: 'Morale',
        command: 'Command',
        injuryMitigation: 'Injury Mitigation',
        guildXp: 'Guild XP'
    });

    const SLOT_MARKS = Object.freeze({
        mainHand: '⚔',
        offHand: '🛡',
        head: '⛨',
        chest: '🛡',
        hands: '✋',
        legs: '🦵',
        feet: '👢',
        cloak: '🧥',
        ring: '💍',
        amulet: '✦'
    });

    const FORGE_TOOLS = Object.freeze([
        {
            id: 'tool-field-whetstone',
            name: 'Field Whetstone',
            mark: '⚙',
            category: 'tool',
            desc: 'Keeps blades keen between marches. Grants minor upkeep efficiency.',
            purchaseGold: 240,
            equipMinRank: 2
        },
        {
            id: 'tool-marching-compass',
            name: 'Marching Compass',
            mark: '🧭',
            category: 'tool',
            desc: 'Calibrated for grid marches and route planning.',
            purchaseGold: 320,
            equipMinRank: 2
        },
        {
            id: 'tool-siege-pry',
            name: 'Siege Pry Bar',
            mark: '⚒',
            category: 'tool',
            desc: 'Breaching lever for siege lanes and fortification work.',
            purchaseGold: 480,
            equipMinRank: 4
        },
        {
            id: 'tool-artificer-kit',
            name: 'Artificer Kit',
            mark: '✦',
            category: 'tool',
            desc: 'Precision tools for advanced fittings and ward stitching.',
            purchaseGold: 1200,
            equipMinRank: 7
        }
    ]);

    const GEAR_CATALOG = Object.freeze([
        { id: 'bm-patrol-blade', name: 'Patrol Blade', slot: 'mainHand', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { strength: 3, morale: 1 }, purchaseGold: 780, equipMinRank: 2, desc: 'Standard battlemaster field blade.' },
        { id: 'bm-training-shield', name: 'Training Shield', slot: 'offHand', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { command: 1, injuryMitigation: 0.02 }, purchaseGold: 620, equipMinRank: 2, desc: 'Light shield for company drills.' },
        { id: 'bm-patrol-helm', name: 'Patrol Helm', slot: 'head', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { strength: 1, injuryMitigation: 0.01 }, purchaseGold: 520, equipMinRank: 2, desc: 'Basic head protection.' },
        { id: 'bm-leather-cuirass', name: 'Leather Cuirass', slot: 'chest', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { strength: 2, injuryMitigation: 0.03 }, purchaseGold: 690, equipMinRank: 2, desc: 'Layered leather chest guard.' },
        { id: 'bm-grip-gloves', name: 'Grip Gloves', slot: 'hands', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { strength: 1, command: 1 }, purchaseGold: 410, equipMinRank: 2, desc: 'Reinforced grip for weapon control.' },
        { id: 'bm-march-greaves', name: 'March Greaves', slot: 'legs', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { morale: 1, injuryMitigation: 0.01 }, purchaseGold: 450, equipMinRank: 2, desc: 'Leg guards for long marches.' },
        { id: 'bm-road-boots', name: 'Road Boots', slot: 'feet', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { morale: 1 }, purchaseGold: 360, equipMinRank: 2, desc: 'Sturdy boots for campaign roads.' },
        { id: 'bm-guild-cloak', name: 'Guild Cloak', slot: 'cloak', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { guildXp: 0.02, command: 1 }, purchaseGold: 540, equipMinRank: 2, desc: 'Guild-issue march cloak.' },
        { id: 'bm-signet-ring', name: 'Signet Ring', slot: 'ring', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { command: 2 }, purchaseGold: 480, equipMinRank: 2, desc: 'Officer signet for command presence.' },
        { id: 'bm-command-amulet', name: 'Command Amulet', slot: 'amulet', classId: 'battlemaster', tier: 1, rarity: 'common', stats: { morale: 2, guildXp: 0.01 }, purchaseGold: 510, equipMinRank: 2, desc: 'Charm of minor battlefield resolve.' },
        { id: 'am-focus-staff', name: 'Focus Staff', slot: 'mainHand', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 4, morale: 1 }, purchaseGold: 820, equipMinRank: 2, desc: 'Channeling staff for battlemages.' },
        { id: 'am-arcane-tome', name: 'Arcane Tome', slot: 'offHand', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 2, command: 1 }, purchaseGold: 640, equipMinRank: 2, desc: 'Spell reference tome.' },
        { id: 'am-circlet', name: 'Circlet of Study', slot: 'head', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 1, guildXp: 0.02 }, purchaseGold: 500, equipMinRank: 2, desc: 'Focus circlet for arcane study.' },
        { id: 'am-robes', name: 'Scholar Robes', slot: 'chest', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 2, injuryMitigation: 0.02 }, purchaseGold: 710, equipMinRank: 2, desc: 'Warded scholar vestments.' },
        { id: 'am-weave-gloves', name: 'Weave Gloves', slot: 'hands', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 1, command: 1 }, purchaseGold: 420, equipMinRank: 2, desc: 'Threaded gloves for spell weaving.' },
        { id: 'am-runed-leggings', name: 'Runed Leggings', slot: 'legs', classId: 'battlemage', tier: 1, rarity: 'common', stats: { morale: 2 }, purchaseGold: 440, equipMinRank: 2, desc: 'Runed march leggings.' },
        { id: 'am-soft-shoes', name: 'Soft Shoes', slot: 'feet', classId: 'battlemage', tier: 1, rarity: 'common', stats: { morale: 1, injuryMitigation: 0.01 }, purchaseGold: 370, equipMinRank: 2, desc: 'Silent-soled arcane footwear.' },
        { id: 'am-mystic-cloak', name: 'Mystic Cloak', slot: 'cloak', classId: 'battlemage', tier: 1, rarity: 'common', stats: { ranged: 1, guildXp: 0.02 }, purchaseGold: 550, equipMinRank: 2, desc: 'Cloak threaded with minor wards.' },
        { id: 'am-band-ring', name: 'Band Ring', slot: 'ring', classId: 'battlemage', tier: 1, rarity: 'common', stats: { command: 2 }, purchaseGold: 490, equipMinRank: 2, desc: 'Simple command band.' },
        { id: 'am-sigil-amulet', name: 'Sigil Amulet', slot: 'amulet', classId: 'battlemage', tier: 1, rarity: 'common', stats: { morale: 2, injuryMitigation: 0.01 }, purchaseGold: 520, equipMinRank: 2, desc: 'Sigil charm for spell stability.' },
        { id: 'bm-veteran-blade', name: 'Veteran Blade', slot: 'mainHand', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { strength: 5, morale: 2 }, purchaseGold: 4200, equipMinRank: 7, desc: 'High-grade assault blade. Purchase early; equip at Herald rank.' },
        { id: 'bm-veteran-shield', name: 'Veteran Shield', slot: 'offHand', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { command: 2, injuryMitigation: 0.04 }, purchaseGold: 3600, equipMinRank: 7, desc: 'Reinforced wall shield for veteran companies.' },
        { id: 'bm-veteran-helm', name: 'Veteran Helm', slot: 'head', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { strength: 2, injuryMitigation: 0.02 }, purchaseGold: 2800, equipMinRank: 7, desc: 'Tempered helm with ward rivets.' },
        { id: 'bm-veteran-cuirass', name: 'Veteran Cuirass', slot: 'chest', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { strength: 3, injuryMitigation: 0.05 }, purchaseGold: 3900, equipMinRank: 7, desc: 'Plate-lined cuirass for front-line duty.' },
        { id: 'bm-veteran-gloves', name: 'Veteran Gauntlets', slot: 'hands', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { strength: 2, command: 2 }, purchaseGold: 2600, equipMinRank: 7, desc: 'Tempered gauntlets for weapon mastery.' },
        { id: 'bm-veteran-greaves', name: 'Veteran Greaves', slot: 'legs', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { morale: 2, injuryMitigation: 0.02 }, purchaseGold: 2500, equipMinRank: 7, desc: 'Veteran march greaves.' },
        { id: 'bm-veteran-boots', name: 'Veteran Boots', slot: 'feet', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { morale: 2 }, purchaseGold: 2200, equipMinRank: 7, desc: 'Reinforced veteran march boots.' },
        { id: 'bm-veteran-cloak', name: 'Veteran Cloak', slot: 'cloak', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { guildXp: 0.04, command: 2 }, purchaseGold: 3000, equipMinRank: 7, desc: 'Officer cloak with guild threading.' },
        { id: 'bm-veteran-ring', name: 'Veteran Ring', slot: 'ring', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { command: 3 }, purchaseGold: 2700, equipMinRank: 7, desc: 'Signet ring of a proven commander.' },
        { id: 'bm-veteran-amulet', name: 'Veteran Amulet', slot: 'amulet', classId: 'battlemaster', tier: 2, rarity: 'uncommon', stats: { morale: 3, guildXp: 0.02 }, purchaseGold: 2900, equipMinRank: 7, desc: 'Battle charm carried by veteran officers.' },
        { id: 'am-veteran-staff', name: 'Veteran Staff', slot: 'mainHand', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 6, morale: 2 }, purchaseGold: 4400, equipMinRank: 7, desc: 'Masterwork focus staff for senior magi.' },
        { id: 'am-veteran-tome', name: 'Veteran Tome', slot: 'offHand', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 3, command: 2 }, purchaseGold: 3400, equipMinRank: 7, desc: 'Expanded spell codex for veteran magi.' },
        { id: 'am-veteran-circlet', name: 'Veteran Circlet', slot: 'head', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 2, guildXp: 0.03 }, purchaseGold: 2700, equipMinRank: 7, desc: 'Circlet tuned for sustained channeling.' },
        { id: 'am-veteran-robes', name: 'Veteran Robes', slot: 'chest', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 3, injuryMitigation: 0.04 }, purchaseGold: 4000, equipMinRank: 7, desc: 'Layered ward robes for battlemage veterans.' },
        { id: 'am-veteran-gloves', name: 'Veteran Gloves', slot: 'hands', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 2, command: 2 }, purchaseGold: 2550, equipMinRank: 7, desc: 'Arcane weave gloves for spell control.' },
        { id: 'am-veteran-leggings', name: 'Veteran Leggings', slot: 'legs', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { morale: 3 }, purchaseGold: 2450, equipMinRank: 7, desc: 'Veteran runed leggings.' },
        { id: 'am-veteran-shoes', name: 'Veteran Shoes', slot: 'feet', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { morale: 2, injuryMitigation: 0.02 }, purchaseGold: 2300, equipMinRank: 7, desc: 'Warded shoes for long campaigns.' },
        { id: 'am-veteran-cloak', name: 'Veteran Cloak', slot: 'cloak', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { ranged: 2, guildXp: 0.04 }, purchaseGold: 3100, equipMinRank: 7, desc: 'Mystic cloak with veteran ward lines.' },
        { id: 'am-veteran-ring', name: 'Veteran Ring', slot: 'ring', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { command: 3 }, purchaseGold: 2750, equipMinRank: 7, desc: 'Ring of senior arcane command.' },
        { id: 'am-veteran-amulet', name: 'Veteran Amulet', slot: 'amulet', classId: 'battlemage', tier: 2, rarity: 'uncommon', stats: { morale: 3, injuryMitigation: 0.02 }, purchaseGold: 2950, equipMinRank: 7, desc: 'Veteran sigil amulet.' },
        { id: 'gear-commanders-signal-horn', name: "Commander's Signal Horn", slot: 'mainHand', classId: 'battlemaster', tier: 2, rarity: 'rare', battleEffect: 'signal-horn', stats: { command: 2, morale: 1 }, purchaseGold: 6800, equipMinRank: 7, desc: 'Battle horn that marks priority targets in PvP.' },
        { id: 'gear-mage-slayer-harpoon', name: 'Mage-Slayer Harpoon', slot: 'mainHand', classId: 'battlemaster', tier: 3, rarity: 'rare', battleEffect: 'mage-slayer-harpoon', stats: { strength: 4 }, purchaseGold: 14200, equipMinRank: 14, desc: 'Anti-magic harpoon. High cost — requires rank 14 to wield.' },
        { id: 'gear-linked-resilient-plating', name: 'Linked Resilient Plating', slot: 'chest', classId: 'battlemaster', tier: 3, rarity: 'rare', battleEffect: 'linked-resilient-plating', stats: { injuryMitigation: 0.05, strength: 2 }, purchaseGold: 15800, equipMinRank: 14, desc: 'Elite linked plate harness for nation assaults.' },
        { id: 'gear-null-stone-aegis', name: 'Null-Stone Aegis', slot: 'offHand', classId: 'battlemaster', tier: 3, rarity: 'epic', battleEffect: 'null-stone-aegis', stats: { injuryMitigation: 0.04, morale: 2 }, purchaseGold: 18500, equipMinRank: 18, desc: 'Null-stone ward shield. Equip at rank 18.' }
    ]);

    const ARMORY_UPGRADE_PATHS = Object.freeze({
        battlemaster: Object.freeze({
            'bm-patrol-blade': 'bm-veteran-blade',
            'bm-training-shield': 'bm-veteran-shield',
            'bm-patrol-helm': 'bm-veteran-helm',
            'bm-leather-cuirass': 'bm-veteran-cuirass',
            'bm-grip-gloves': 'bm-veteran-gloves',
            'bm-march-greaves': 'bm-veteran-greaves',
            'bm-road-boots': 'bm-veteran-boots',
            'bm-guild-cloak': 'bm-veteran-cloak',
            'bm-signet-ring': 'bm-veteran-ring',
            'bm-command-amulet': 'bm-veteran-amulet'
        }),
        battlemage: Object.freeze({
            'am-focus-staff': 'am-veteran-staff',
            'am-arcane-tome': 'am-veteran-tome',
            'am-circlet': 'am-veteran-circlet',
            'am-robes': 'am-veteran-robes',
            'am-weave-gloves': 'am-veteran-gloves',
            'am-runed-leggings': 'am-veteran-leggings',
            'am-soft-shoes': 'am-veteran-shoes',
            'am-mystic-cloak': 'am-veteran-cloak',
            'am-band-ring': 'am-veteran-ring',
            'am-sigil-amulet': 'am-veteran-amulet'
        })
    });

    const FORGE_EYEBROW_BY_TIER = Object.freeze({
        village: 'Village Smithy',
        town: 'Town Forge',
        city: 'Blacksmith',
        citadel: 'Master Forge',
        kingdom: 'Royal Forge'
    });

    const ARMORY_EYEBROW_BY_TIER = Object.freeze({
        village: 'Village Armory',
        town: 'Town Armory',
        city: 'Armory',
        citadel: 'Master Armory',
        kingdom: 'Royal Armory'
    });

    const GEAR_BY_ID = Object.freeze(
        GEAR_CATALOG.reduce((map, item) => {
            map[item.id] = item;
            return map;
        }, {})
    );

    const TOOL_BY_ID = Object.freeze(
        FORGE_TOOLS.reduce((map, item) => {
            map[item.id] = item;
            return map;
        }, {})
    );

    let handlersBound = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveCommanderRank() {
        return Math.max(1, Math.floor(Number(global.player?.rank) || 1));
    }

    function resolveCommanderClassId() {
        const path = String(global.player?.path || global.confirmedPath || 'PHYS').trim().toUpperCase();
        if (path === 'MAG' || path === 'MAGIC' || path === 'BATTLEMAGE') return 'battlemage';
        return 'battlemaster';
    }

    function resolveRankThresholdLabel(rank) {
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const meta = rankTitles?.resolveSelfCommanderRankMeta?.() || {};
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(rank, meta.path, meta.rankTitleGender);
        }
        return `rank ${rank}`;
    }

    function createDefaultState() {
        return { ownedGearIds: [], ownedToolIds: [], equipped: {} };
    }

    function readState() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return createDefaultState();
            const parsed = JSON.parse(raw);
            return {
                ownedGearIds: Array.isArray(parsed?.ownedGearIds)
                    ? [...new Set(parsed.ownedGearIds.map((id) => String(id || '').trim()).filter(Boolean))]
                    : [],
                ownedToolIds: Array.isArray(parsed?.ownedToolIds)
                    ? [...new Set(parsed.ownedToolIds.map((id) => String(id || '').trim()).filter(Boolean))]
                    : [],
                equipped: parsed?.equipped && typeof parsed.equipped === 'object' ? { ...parsed.equipped } : {}
            };
        } catch (_error) {
            return createDefaultState();
        }
    }

    function writeState(state) {
        const next = {
            ownedGearIds: [...new Set((state?.ownedGearIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            ownedToolIds: [...new Set((state?.ownedToolIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            equipped: state?.equipped && typeof state.equipped === 'object' ? { ...state.equipped } : {}
        };
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            syncPlayerGearSlots(next.equipped);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function syncPlayerGearSlots(equipped) {
        if (!global.player || typeof equipped !== 'object') return;
        const slots = {};
        Object.entries(equipped).forEach(([slot, itemId]) => {
            const id = String(itemId || '').trim();
            if (id) slots[slot] = id;
        });
        global.player.ageGearSlots = Object.keys(slots).length ? slots : null;
    }

    function resolveGold() {
        if (global.RoyalArmiesAgeGold?.resolveAgeCommanderGold) {
            return global.RoyalArmiesAgeGold.resolveAgeCommanderGold();
        }
        if (typeof global.resolveAgeCommanderGold === 'function') {
            return global.resolveAgeCommanderGold();
        }
        return 0;
    }

    function formatGold(amount) {
        if (global.RoyalArmiesAgeGold?.formatAgeHudGoldDisplay) {
            return global.RoyalArmiesAgeGold.formatAgeHudGoldDisplay(amount);
        }
        return Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString('en-US');
    }

    function spendGold(amount, source) {
        const cost = Math.max(0, Math.floor(Number(amount) || 0));
        if (!cost) return true;
        if (resolveGold() < cost) return false;
        if (global.RoyalArmiesAgeGold?.applyAgeCommanderGoldDelta) {
            global.RoyalArmiesAgeGold.applyAgeCommanderGoldDelta(-cost, { source: source || 'gear-shop' });
            return true;
        }
        if (typeof global.applyAgeCommanderGoldDelta === 'function') {
            global.applyAgeCommanderGoldDelta(-cost, { source: source || 'gear-shop' });
            return true;
        }
        return false;
    }

    function sumStatValues(stats) {
        if (!stats || typeof stats !== 'object') return 0;
        let total = 0;
        Object.entries(stats).forEach(([key, value]) => {
            const qty = Math.max(0, Number(value) || 0);
            if (key === 'injuryMitigation' || key === 'guildXp') {
                total += qty * 100;
            } else {
                total += qty;
            }
        });
        return total;
    }

    function computeUpgradeGoldCost(fromItem, toItem) {
        const fromStats = fromItem?.stats || {};
        const toStats = toItem?.stats || {};
        let deltaGold = 400;
        Object.keys({ ...fromStats, ...toStats }).forEach((key) => {
            const before = Math.max(0, Number(fromStats[key]) || 0);
            const after = Math.max(0, Number(toStats[key]) || 0);
            const delta = Math.max(0, after - before);
            if (!delta) return;
            if (key === 'injuryMitigation' || key === 'guildXp') {
                deltaGold += Math.round(delta * 3200);
            } else {
                deltaGold += Math.round(delta * 240);
            }
        });
        if (toItem?.battleEffect && !fromItem?.battleEffect) {
            deltaGold += 1800;
        }
        return Math.max(500, deltaGold);
    }

    function formatStatSummary(stats) {
        if (!stats || typeof stats !== 'object') return '';
        return Object.entries(stats)
            .map(([key, value]) => {
                const qty = Math.max(0, Number(value) || 0);
                if (!qty) return '';
                const label = STAT_LABELS[key] || key;
                if (key === 'injuryMitigation' || key === 'guildXp') {
                    return `+${Math.round(qty * 1000) / 10}% ${label}`;
                }
                return `+${qty} ${label}`;
            })
            .filter(Boolean)
            .join(' · ');
    }

    function resolveForgeCatalog(classId) {
        return GEAR_CATALOG.filter((item) => item.classId === classId);
    }

    function resolveArmoryUpgrades(classId, equipped) {
        const paths = ARMORY_UPGRADE_PATHS[classId] || {};
        const upgrades = [];
        Object.entries(equipped || {}).forEach(([slot, itemId]) => {
            const currentId = String(itemId || '').trim();
            const nextId = paths[currentId];
            if (!nextId) return;
            const current = GEAR_BY_ID[currentId];
            const next = GEAR_BY_ID[nextId];
            if (!current || !next) return;
            upgrades.push({
                slot,
                slotLabel: current.slot,
                current,
                next,
                upgradeGold: computeUpgradeGoldCost(current, next),
                statGain: formatStatSummary(next.stats)
            });
        });
        return upgrades;
    }

    function resolveOwnedGearSet(state) {
        return new Set(state?.ownedGearIds || []);
    }

    function resolveOwnedToolSet(state) {
        return new Set(state?.ownedToolIds || []);
    }

    function isEquipped(state, itemId) {
        const id = String(itemId || '').trim();
        return Object.values(state?.equipped || {}).some((value) => String(value || '').trim() === id);
    }

    function renderForgeRow(item, state, rank) {
        const owned = resolveOwnedGearSet(state).has(item.id);
        const equipped = isEquipped(state, item.id);
        const canEquip = rank >= item.equipMinRank;
        const gold = resolveGold();
        const canAfford = gold >= item.purchaseGold;
        const statsLine = formatStatSummary(item.stats);
        const equipGate = canEquip
            ? ''
            : `Equip at ${resolveRankThresholdLabel(item.equipMinRank)}`;

        let actionHtml = '';
        if (equipped) {
            actionHtml = '<span class="age-defense-upgrade-status">Equipped</span>';
        } else if (owned) {
            actionHtml = canEquip
                ? `<button type="button" class="age-defense-upgrade-queue-btn" data-forge-equip="${escapeHtml(item.id)}">Equip</button>`
                : `<span class="age-defense-upgrade-status">${escapeHtml(equipGate)}</span>`;
        } else {
            actionHtml = `<button type="button" class="age-defense-upgrade-queue-btn" data-forge-purchase="${escapeHtml(item.id)}"${canAfford ? '' : ' disabled'}>Purchase</button>`;
        }

        return (
            `<li class="age-defense-upgrade-row${owned ? ' is-queued' : ''}${!canAfford && !owned ? ' is-slot-taken' : ''}">`
            + `<span class="age-defense-upgrade-mark" aria-hidden="true">${escapeHtml(SLOT_MARKS[item.slot] || item.mark || '•')}</span>`
            + '<div class="age-defense-upgrade-main">'
            + `<span class="age-defense-upgrade-title">${escapeHtml(item.name)}</span>`
            + `<span class="age-defense-upgrade-desc">${escapeHtml(item.desc)}${statsLine ? ` · ${escapeHtml(statsLine)}` : ''}</span>`
            + (equipGate && !owned ? `<span class="age-gear-shop-equip-gate">${escapeHtml(equipGate)}</span>` : '')
            + '</div>'
            + `<span class="age-defense-upgrade-cost">${escapeHtml(formatGold(item.purchaseGold))} gold</span>`
            + actionHtml
            + '</li>'
        );
    }

    function renderToolRow(tool, state, rank) {
        const owned = resolveOwnedToolSet(state).has(tool.id);
        const canUse = rank >= tool.equipMinRank;
        const gold = resolveGold();
        const canAfford = gold >= tool.purchaseGold;
        const gate = canUse ? '' : `Usable at ${resolveRankThresholdLabel(tool.equipMinRank)}`;

        const actionHtml = owned
            ? `<span class="age-defense-upgrade-status">${canUse ? 'Owned' : escapeHtml(gate)}</span>`
            : `<button type="button" class="age-defense-upgrade-queue-btn" data-forge-tool-purchase="${escapeHtml(tool.id)}"${canAfford ? '' : ' disabled'}>Purchase</button>`;

        return (
            `<li class="age-defense-upgrade-row${owned ? ' is-queued' : ''}">`
            + `<span class="age-defense-upgrade-mark" aria-hidden="true">${escapeHtml(tool.mark || '⚙')}</span>`
            + '<div class="age-defense-upgrade-main">'
            + `<span class="age-defense-upgrade-title">${escapeHtml(tool.name)}</span>`
            + `<span class="age-defense-upgrade-desc">${escapeHtml(tool.desc)}</span>`
            + (gate && !owned ? `<span class="age-gear-shop-equip-gate">${escapeHtml(gate)}</span>` : '')
            + '</div>'
            + `<span class="age-defense-upgrade-cost">${escapeHtml(formatGold(tool.purchaseGold))} gold</span>`
            + actionHtml
            + '</li>'
        );
    }

    function renderArmoryRow(upgrade, rank) {
        const canUpgrade = rank >= upgrade.next.equipMinRank;
        const gold = resolveGold();
        const canAfford = gold >= upgrade.upgradeGold;
        const gate = canUpgrade
            ? ''
            : `Requires ${resolveRankThresholdLabel(upgrade.next.equipMinRank)}`;

        const actionHtml = canUpgrade
            ? `<button type="button" class="age-defense-upgrade-queue-btn" data-armory-upgrade="${escapeHtml(upgrade.slot)}"${canAfford ? '' : ' disabled'}>Upgrade</button>`
            : `<span class="age-defense-upgrade-status">${escapeHtml(gate)}</span>`;

        return (
            `<li class="age-defense-upgrade-row">`
            + `<span class="age-defense-upgrade-mark" aria-hidden="true">${escapeHtml(SLOT_MARKS[upgrade.slot] || '⧉')}</span>`
            + '<div class="age-defense-upgrade-main">'
            + `<span class="age-defense-upgrade-title">${escapeHtml(upgrade.current.name)} → ${escapeHtml(upgrade.next.name)}</span>`
            + `<span class="age-defense-upgrade-desc">Gain: ${escapeHtml(upgrade.statGain || 'Improved battle stats')}</span>`
            + '</div>'
            + `<span class="age-defense-upgrade-cost">${escapeHtml(formatGold(upgrade.upgradeGold))} gold</span>`
            + actionHtml
            + '</li>'
        );
    }

    function renderForgeBody(options = {}) {
        const classId = resolveCommanderClassId();
        const rank = resolveCommanderRank();
        const state = readState();
        const gear = resolveForgeCatalog(classId);
        const weapons = gear.filter((item) => item.slot === 'mainHand' || item.slot === 'offHand');
        const armor = gear.filter((item) => ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'].includes(item.slot));
        const accessories = gear.filter((item) => item.slot === 'ring' || item.slot === 'amulet');
        const tierNote = 'High-tier wares can be purchased early, but equipping them requires the listed commander rank.';

        const section = (title, items) => (
            '<section class="age-defense-upgrades" aria-label="' + escapeHtml(title) + '">'
            + '<h3 class="age-defense-upgrades-title">' + escapeHtml(title) + '</h3>'
            + '<ul class="age-defense-upgrade-list">'
            + items.map((item) => renderForgeRow(item, state, rank)).join('')
            + '</ul>'
            + '</section>'
        );

        return (
            '<div class="age-defense-workspace age-gear-shop-workspace">'
            + '<p class="age-army-workspace-toolbar-note">Purchase weapons, armor, accessories, and field tools with commander gold. '
            + escapeHtml(tierNote) + '</p>'
            + section('Weapons', weapons)
            + section('Armor', armor)
            + section('Accessories', accessories)
            + '<section class="age-defense-upgrades" aria-label="Field tools">'
            + '<h3 class="age-defense-upgrades-title">Tools &amp; Kits</h3>'
            + '<ul class="age-defense-upgrade-list">'
            + FORGE_TOOLS.map((tool) => renderToolRow(tool, state, rank)).join('')
            + '</ul>'
            + '</section>'
            + '<p id="age-gear-shop-status" class="age-defense-workspace-status" aria-live="polite" hidden></p>'
            + '</div>'
        );
    }

    function renderArmoryBody() {
        const classId = resolveCommanderClassId();
        const rank = resolveCommanderRank();
        const state = readState();
        const upgrades = resolveArmoryUpgrades(classId, state.equipped);

        const listHtml = upgrades.length
            ? upgrades.map((entry) => renderArmoryRow(entry, rank)).join('')
            : '<li class="age-defense-upgrade-row"><div class="age-defense-upgrade-main"><span class="age-defense-upgrade-title">No upgrades ready</span>'
                + '<span class="age-defense-upgrade-desc">Equip forge gear in a slot, then return here to upgrade it for improved stats.</span></div></li>';

        return (
            '<div class="age-defense-workspace age-gear-shop-workspace">'
            + '<p class="age-army-workspace-toolbar-note">Upgrade equipped weapons and armor with gold. Upgrade costs scale with the stat gains you receive.</p>'
            + '<section class="age-defense-upgrades" aria-label="Armory upgrades">'
            + '<h3 class="age-defense-upgrades-title">Equipment Upgrades</h3>'
            + '<ul class="age-defense-upgrade-list">' + listHtml + '</ul>'
            + '</section>'
            + '<p id="age-gear-shop-status" class="age-defense-workspace-status" aria-live="polite" hidden></p>'
            + '</div>'
        );
    }

    function setShopStatus(message, isError) {
        const statusEl = global.document.getElementById('age-gear-shop-status');
        if (!statusEl) return;
        const text = String(message || '').trim();
        if (!text) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            statusEl.classList.remove('is-error');
            return;
        }
        statusEl.hidden = false;
        statusEl.textContent = text;
        statusEl.classList.toggle('is-error', Boolean(isError));
    }

    function refreshActiveBody(activeVenueId) {
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!bodyEl) return;
        if (activeVenueId === 'blacksmith') {
            bodyEl.innerHTML = renderForgeBody();
        } else if (activeVenueId === 'armory') {
            bodyEl.innerHTML = renderArmoryBody();
        }
    }

    function purchaseForgeItem(itemId) {
        const item = GEAR_BY_ID[String(itemId || '').trim()];
        if (!item) return false;
        const state = readState();
        if (resolveOwnedGearSet(state).has(item.id)) {
            setShopStatus(`${item.name} is already in your inventory.`, true);
            return false;
        }
        if (resolveGold() < item.purchaseGold) {
            setShopStatus('Not enough gold for this purchase.', true);
            return false;
        }
        if (!spendGold(item.purchaseGold, 'forge-purchase')) {
            setShopStatus('Not enough gold for this purchase.', true);
            return false;
        }
        state.ownedGearIds.push(item.id);
        writeState(state);
        setShopStatus(`${item.name} purchased. ${item.equipMinRank > resolveCommanderRank()
            ? `Equip at ${resolveRankThresholdLabel(item.equipMinRank)}.`
            : 'Ready to equip.'}`);
        return true;
    }

    function purchaseTool(toolId) {
        const tool = TOOL_BY_ID[String(toolId || '').trim()];
        if (!tool) return false;
        const state = readState();
        if (resolveOwnedToolSet(state).has(tool.id)) {
            setShopStatus(`${tool.name} is already owned.`, true);
            return false;
        }
        if (resolveGold() < tool.purchaseGold || !spendGold(tool.purchaseGold, 'forge-tool')) {
            setShopStatus('Not enough gold for this tool.', true);
            return false;
        }
        state.ownedToolIds.push(tool.id);
        writeState(state);
        setShopStatus(`${tool.name} added to your field kits.`);
        return true;
    }

    function equipForgeItem(itemId) {
        const item = GEAR_BY_ID[String(itemId || '').trim()];
        if (!item) return false;
        const rank = resolveCommanderRank();
        if (rank < item.equipMinRank) {
            setShopStatus(`Equip ${item.name} at ${resolveRankThresholdLabel(item.equipMinRank)}.`, true);
            return false;
        }
        const state = readState();
        if (!resolveOwnedGearSet(state).has(item.id)) {
            setShopStatus('Purchase this item at the forge first.', true);
            return false;
        }
        state.equipped[item.slot] = item.id;
        writeState(state);
        setShopStatus(`${item.name} equipped.`);
        return true;
    }

    function upgradeArmorySlot(slotId) {
        const slot = String(slotId || '').trim();
        const classId = resolveCommanderClassId();
        const state = readState();
        const currentId = String(state.equipped?.[slot] || '').trim();
        const paths = ARMORY_UPGRADE_PATHS[classId] || {};
        const nextId = paths[currentId];
        const current = GEAR_BY_ID[currentId];
        const next = GEAR_BY_ID[nextId];
        if (!current || !next) {
            setShopStatus('No upgrade available for that slot.', true);
            return false;
        }
        const rank = resolveCommanderRank();
        if (rank < next.equipMinRank) {
            setShopStatus(`Upgrade requires ${resolveRankThresholdLabel(next.equipMinRank)}.`, true);
            return false;
        }
        const cost = computeUpgradeGoldCost(current, next);
        if (resolveGold() < cost || !spendGold(cost, 'armory-upgrade')) {
            setShopStatus('Not enough gold for this upgrade.', true);
            return false;
        }
        if (!resolveOwnedGearSet(state).has(next.id)) {
            state.ownedGearIds.push(next.id);
        }
        state.equipped[slot] = next.id;
        writeState(state);
        setShopStatus(`${current.name} upgraded to ${next.name} for ${formatGold(cost)} gold.`);
        return true;
    }

    function resolveEquipmentRankLockReason() {
        const rank = resolveCommanderRank();
        if (rank >= EQUIPMENT_MIN_RANK) return '';
        return `Unlocks at ${resolveRankThresholdLabel(EQUIPMENT_MIN_RANK)}.`;
    }

    function resolveForgeEyebrow(settlementTier) {
        const tier = String(settlementTier || 'city').trim().toLowerCase();
        return FORGE_EYEBROW_BY_TIER[tier] || FORGE_EYEBROW_BY_TIER.city;
    }

    function resolveArmoryEyebrow(settlementTier) {
        const tier = String(settlementTier || 'city').trim().toLowerCase();
        return ARMORY_EYEBROW_BY_TIER[tier] || ARMORY_EYEBROW_BY_TIER.city;
    }

    function onGearShopClick(event, activeVenueId) {
        if (activeVenueId !== 'blacksmith' && activeVenueId !== 'armory') return false;

        const purchaseBtn = event.target.closest('[data-forge-purchase]');
        if (purchaseBtn && !purchaseBtn.disabled) {
            event.preventDefault();
            if (purchaseForgeItem(purchaseBtn.getAttribute('data-forge-purchase'))) {
                refreshActiveBody(activeVenueId);
            }
            return true;
        }

        const toolBtn = event.target.closest('[data-forge-tool-purchase]');
        if (toolBtn && !toolBtn.disabled) {
            event.preventDefault();
            if (purchaseTool(toolBtn.getAttribute('data-forge-tool-purchase'))) {
                refreshActiveBody(activeVenueId);
            }
            return true;
        }

        const equipBtn = event.target.closest('[data-forge-equip]');
        if (equipBtn) {
            event.preventDefault();
            if (equipForgeItem(equipBtn.getAttribute('data-forge-equip'))) {
                refreshActiveBody(activeVenueId);
            }
            return true;
        }

        const upgradeBtn = event.target.closest('[data-armory-upgrade]');
        if (upgradeBtn && !upgradeBtn.disabled) {
            event.preventDefault();
            if (upgradeArmorySlot(upgradeBtn.getAttribute('data-armory-upgrade'))) {
                refreshActiveBody(activeVenueId);
            }
            return true;
        }

        return false;
    }

    function bindHandlers() {
        if (handlersBound) return;
        handlersBound = true;
        global.addEventListener('royalarmies:age-gold-updated', () => {
            const workspace = global.document.getElementById('age-settlement-venue-workspace');
            if (!workspace || workspace.hidden) return;
            const venueId = global.RoyalArmiesSettlementVenueWorkspaces?.getActiveVenueId?.();
            if (venueId === 'blacksmith' || venueId === 'armory') {
                refreshActiveBody(venueId);
            }
        });
        global.addEventListener('royalarmies:age-commander-rank-updated', () => {
            const workspace = global.document.getElementById('age-settlement-venue-workspace');
            if (!workspace || workspace.hidden) return;
            const venueId = global.RoyalArmiesSettlementVenueWorkspaces?.getActiveVenueId?.();
            if (venueId === 'blacksmith' || venueId === 'armory') {
                refreshActiveBody(venueId);
            }
        });
    }

    bindHandlers();

    global.RoyalArmiesAgeGearShop = Object.freeze({
        EQUIPMENT_MIN_RANK,
        renderForgeBody,
        renderArmoryBody,
        onGearShopClick,
        resolveEquipmentRankLockReason,
        resolveForgeEyebrow,
        resolveArmoryEyebrow,
        refreshActiveBody,
        readState,
        writeState
    });
})(window);

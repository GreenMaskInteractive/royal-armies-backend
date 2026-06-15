/**
 * RIFT — Forge (Blacksmith) purchases & Armory gold upgrades for commander gear.
 */
(function initRoyalArmiesAgeGearShop(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-gear-shop-state';
    const EQUIPMENT_MIN_RANK = 2;
    const MAX_GEAR_LEVEL = 15;
    const ARMORY_UPGRADE_MIN_LEVEL = 5;

    const BATTLE_XP_SLOTS = Object.freeze(new Set([
        'mainHand', 'offHand', 'head', 'chest', 'hands', 'legs', 'feet', 'cloak'
    ]));

    const BATTLE_XP_BY_OUTCOME = Object.freeze({
        commander: 18,
        draw: 12,
        npc: 8
    });

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

    const FORGE_CATEGORIES = Object.freeze([
        { id: 'weapons', label: 'Weapons', slots: ['mainHand', 'offHand'] },
        { id: 'armor', label: 'Armor', slots: ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'] },
        { id: 'accessories', label: 'Accessories', slots: ['ring', 'amulet'] },
        { id: 'tools', label: 'Tools & Kits', isTools: true }
    ]);

    const ARMORY_CATEGORIES = Object.freeze([
        { id: 'weapons', label: 'Weapons', slots: ['mainHand', 'offHand'] },
        { id: 'armor', label: 'Armor', slots: ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'] },
        { id: 'accessories', label: 'Accessories', slots: ['ring', 'amulet'] }
    ]);

    const FORGE_TOOLS = Object.freeze([
        {
            id: 'tool-emberstone-whetstone',
            name: 'Emberstone Whetstone',
            mark: '⚙',
            category: 'tool',
            desc: 'A heat-charged whetstone that steadies blade and spell focus alike on long campaigns.',
            stats: { morale: 1, guildXp: 0.01 },
            purchaseGold: 260,
            equipMinRank: 2
        },
        {
            id: 'tool-meridian-compass',
            name: 'Meridian March Compass',
            mark: '🧭',
            category: 'tool',
            desc: 'Star-cut compass for grid marches—favored by physical captains and arcane marshals.',
            stats: { command: 1 },
            purchaseGold: 340,
            equipMinRank: 2
        },
        {
            id: 'tool-siegebreaker-pry',
            name: 'Siegebreaker Pry',
            mark: '⚒',
            category: 'tool',
            desc: 'Lever forged for breaching lanes; lends raw force and guarded footing under strain.',
            stats: { strength: 1, injuryMitigation: 0.01 },
            purchaseGold: 500,
            equipMinRank: 4
        },
        {
            id: 'tool-wardwright-kit',
            name: 'Wardwright Artificer Kit',
            mark: '✦',
            category: 'tool',
            desc: 'Precision fittings and ward-stitch tools for commanders who blend steel and sigil craft.',
            stats: { ranged: 1, guildXp: 0.02 },
            purchaseGold: 1250,
            equipMinRank: 7
        }
    ]);

    const GEAR_CATALOG = Object.freeze([
        { id: 'cmd-ironheart-saber', name: 'Ironheart Saber', slot: 'mainHand', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, morale: 1 }, purchaseGold: 800, equipMinRank: 2, desc: 'A balanced field blade suited to steel and spell alike.' },
        { id: 'cmd-warded-bulwark', name: 'Warded Bulwark', slot: 'offHand', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, ranged: 1, injuryMitigation: 0.02 }, purchaseGold: 650, equipMinRank: 2, desc: 'Shield lined with minor wards—steady for melee and channelers.' },
        { id: 'cmd-oathbound-visor', name: 'Oathbound Visor', slot: 'head', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, injuryMitigation: 0.01 }, purchaseGold: 540, equipMinRank: 2, desc: 'Visor etched with dual-path oaths of the Royal Armies.' },
        { id: 'cmd-concord-mail', name: 'Concord Mail', slot: 'chest', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, injuryMitigation: 0.03 }, purchaseGold: 720, equipMinRank: 2, desc: 'Mail that flexes for sword-work and sigil-weave alike.' },
        { id: 'cmd-duelweave-gauntlets', name: 'Duelweave Gauntlets', slot: 'hands', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, command: 1 }, purchaseGold: 430, equipMinRank: 2, desc: 'Threaded gauntlets for weapon grip and spell shaping.' },
        { id: 'cmd-marchward-greaves', name: 'Marchward Greaves', slot: 'legs', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, command: 1, injuryMitigation: 0.01 }, purchaseGold: 460, equipMinRank: 2, desc: 'Greaves worn on every path through hostile territory.' },
        { id: 'cmd-pathfinder-treads', name: 'Pathfinder Treads', slot: 'feet', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, injuryMitigation: 0.01, command: 1 }, purchaseGold: 380, equipMinRank: 2, desc: 'Boots that keep commanders sure-footed in melee or ritual march.' },
        { id: 'cmd-bannercloak-accord', name: 'Bannercloak of Accord', slot: 'cloak', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, guildXp: 0.02, morale: 1 }, purchaseGold: 560, equipMinRank: 2, desc: 'Guild-issue cloak signaling unity of physical and arcane companies.' },
        { id: 'cmd-covenant-signet', name: 'Covenant Signet', slot: 'ring', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 2 }, purchaseGold: 500, equipMinRank: 2, desc: 'Signet ring of shared command authority.' },
        { id: 'cmd-twinpath-talisman', name: 'Twinpath Talisman', slot: 'amulet', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 2, injuryMitigation: 0.01 }, purchaseGold: 530, equipMinRank: 2, desc: 'Charm balancing resolve for blade and spell commanders.' },
        { id: 'cmd-sovereign-edge', name: "Sovereign's Edge", slot: 'mainHand', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 4, ranged: 4, morale: 2 }, purchaseGold: 4400, equipMinRank: 7, desc: 'Masterwork edge for veteran officers of either path.' },
        { id: 'cmd-bastion-two-paths', name: 'Bastion of Two Paths', slot: 'offHand', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, ranged: 1, injuryMitigation: 0.04 }, purchaseGold: 3700, equipMinRank: 7, desc: 'Reinforced ward-shield carried by herald-ranked commanders.' },
        { id: 'cmd-crownward-casque', name: 'Crownward Casque', slot: 'head', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, injuryMitigation: 0.02 }, purchaseGold: 2900, equipMinRank: 7, desc: 'Tempered casque with riveted ward lines.' },
        { id: 'cmd-aegis-of-concord', name: 'Aegis of Concord', slot: 'chest', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 3, ranged: 3, injuryMitigation: 0.05 }, purchaseGold: 4000, equipMinRank: 7, desc: 'Plate-lined harness for front-line duty on any path.' },
        { id: 'cmd-warfinger-gauntlets', name: 'Warfinger Gauntlets', slot: 'hands', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, command: 2 }, purchaseGold: 2650, equipMinRank: 7, desc: 'Tempered gauntlets for weapon mastery and spell control.' },
        { id: 'cmd-legionward-plates', name: 'Legionward Plates', slot: 'legs', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, command: 2, injuryMitigation: 0.02 }, purchaseGold: 2550, equipMinRank: 7, desc: 'Veteran leg plates for long campaign marches.' },
        { id: 'cmd-ironpath-sabatons', name: 'Ironpath Sabatons', slot: 'feet', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, injuryMitigation: 0.02 }, purchaseGold: 2350, equipMinRank: 7, desc: 'Reinforced march boots with warded soles.' },
        { id: 'cmd-marshal-pathcloak', name: "Marshal's Pathcloak", slot: 'cloak', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, guildXp: 0.04, morale: 2 }, purchaseGold: 3100, equipMinRank: 7, desc: 'Officer cloak threaded for guild recognition on both paths.' },
        { id: 'cmd-oathkeeper-band', name: "Oathkeeper's Band", slot: 'ring', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 3 }, purchaseGold: 2800, equipMinRank: 7, desc: 'Ring of a proven dual-path commander.' },
        { id: 'cmd-dualheart-amulet', name: 'Dualheart Amulet', slot: 'amulet', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 3, injuryMitigation: 0.02, guildXp: 0.01 }, purchaseGold: 3000, equipMinRank: 7, desc: 'Battle charm carried by herald-ranked veterans.' },
        { id: 'gear-horn-rallying-dawn', name: 'Horn of Rallying Dawn', slot: 'mainHand', classId: 'commander', tier: 2, rarity: 'rare', battleEffect: 'signal-horn', stats: { command: 2, morale: 1, strength: 1, ranged: 1 }, purchaseGold: 6800, equipMinRank: 7, desc: 'Battle horn that marks priority targets in PvP.' },
        { id: 'gear-nullspike-harpoon', name: 'Nullspike Harpoon', slot: 'mainHand', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'mage-slayer-harpoon', stats: { strength: 3, ranged: 2 }, purchaseGold: 14200, equipMinRank: 14, desc: 'Anti-magic harpoon—high cost, requires rank 14 to wield.' },
        { id: 'gear-phoenix-interlock', name: 'Phoenix Interlock Plate', slot: 'chest', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'linked-resilient-plating', stats: { injuryMitigation: 0.05, strength: 2, ranged: 2 }, purchaseGold: 15800, equipMinRank: 14, desc: 'Elite linked plate harness for nation assaults.' },
        { id: 'gear-nullstone-palladium', name: 'Nullstone Palladium', slot: 'offHand', classId: 'commander', tier: 3, rarity: 'epic', battleEffect: 'null-stone-aegis', stats: { injuryMitigation: 0.04, morale: 2, command: 1 }, purchaseGold: 18500, equipMinRank: 18, desc: 'Null-stone ward shield. Equip at rank 18.' }
    ]);

    const ARMORY_UPGRADE_PATHS = Object.freeze({
        commander: Object.freeze({
            'cmd-ironheart-saber': 'cmd-sovereign-edge',
            'cmd-warded-bulwark': 'cmd-bastion-two-paths',
            'cmd-oathbound-visor': 'cmd-crownward-casque',
            'cmd-concord-mail': 'cmd-aegis-of-concord',
            'cmd-duelweave-gauntlets': 'cmd-warfinger-gauntlets',
            'cmd-marchward-greaves': 'cmd-legionward-plates',
            'cmd-pathfinder-treads': 'cmd-ironpath-sabatons',
            'cmd-bannercloak-accord': 'cmd-marshal-pathcloak',
            'cmd-covenant-signet': 'cmd-oathkeeper-band',
            'cmd-twinpath-talisman': 'cmd-dualheart-amulet'
        })
    });

    const LEGACY_GEAR_ID_MAP = Object.freeze({
        'bm-patrol-blade': 'cmd-ironheart-saber',
        'am-focus-staff': 'cmd-ironheart-saber',
        'bm-training-shield': 'cmd-warded-bulwark',
        'am-arcane-tome': 'cmd-warded-bulwark',
        'bm-patrol-helm': 'cmd-oathbound-visor',
        'am-circlet': 'cmd-oathbound-visor',
        'bm-leather-cuirass': 'cmd-concord-mail',
        'am-robes': 'cmd-concord-mail',
        'bm-grip-gloves': 'cmd-duelweave-gauntlets',
        'am-weave-gloves': 'cmd-duelweave-gauntlets',
        'bm-march-greaves': 'cmd-marchward-greaves',
        'am-runed-leggings': 'cmd-marchward-greaves',
        'bm-road-boots': 'cmd-pathfinder-treads',
        'am-soft-shoes': 'cmd-pathfinder-treads',
        'bm-guild-cloak': 'cmd-bannercloak-accord',
        'am-mystic-cloak': 'cmd-bannercloak-accord',
        'bm-signet-ring': 'cmd-covenant-signet',
        'am-band-ring': 'cmd-covenant-signet',
        'bm-command-amulet': 'cmd-twinpath-talisman',
        'am-sigil-amulet': 'cmd-twinpath-talisman',
        'bm-veteran-blade': 'cmd-sovereign-edge',
        'am-veteran-staff': 'cmd-sovereign-edge',
        'bm-veteran-shield': 'cmd-bastion-two-paths',
        'am-veteran-tome': 'cmd-bastion-two-paths',
        'bm-veteran-helm': 'cmd-crownward-casque',
        'am-veteran-circlet': 'cmd-crownward-casque',
        'bm-veteran-cuirass': 'cmd-aegis-of-concord',
        'am-veteran-robes': 'cmd-aegis-of-concord',
        'bm-veteran-gloves': 'cmd-warfinger-gauntlets',
        'am-veteran-gloves': 'cmd-warfinger-gauntlets',
        'bm-veteran-greaves': 'cmd-legionward-plates',
        'am-veteran-leggings': 'cmd-legionward-plates',
        'bm-veteran-boots': 'cmd-ironpath-sabatons',
        'am-veteran-shoes': 'cmd-ironpath-sabatons',
        'bm-veteran-cloak': 'cmd-marshal-pathcloak',
        'am-veteran-cloak': 'cmd-marshal-pathcloak',
        'bm-veteran-ring': 'cmd-oathkeeper-band',
        'am-veteran-ring': 'cmd-oathkeeper-band',
        'bm-veteran-amulet': 'cmd-dualheart-amulet',
        'am-veteran-amulet': 'cmd-dualheart-amulet',
        'gear-commanders-signal-horn': 'gear-horn-rallying-dawn',
        'gear-mage-slayer-harpoon': 'gear-nullspike-harpoon',
        'gear-linked-resilient-plating': 'gear-phoenix-interlock',
        'gear-null-stone-aegis': 'gear-nullstone-palladium',
        'tool-field-whetstone': 'tool-emberstone-whetstone',
        'tool-marching-compass': 'tool-meridian-compass',
        'tool-siege-pry': 'tool-siegebreaker-pry',
        'tool-artificer-kit': 'tool-wardwright-kit'
    });

    const LEGACY_TOOL_ID_MAP = Object.freeze({
        'tool-field-whetstone': 'tool-emberstone-whetstone',
        'tool-marching-compass': 'tool-meridian-compass',
        'tool-siege-pry': 'tool-siegebreaker-pry',
        'tool-artificer-kit': 'tool-wardwright-kit'
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
    let uiHandlersBound = false;
    let gearLevelUpQueue = [];
    let gearLevelUpShowing = false;
    let gearLevelUpOverlayBound = false;
    let activeForgeCategory = 'weapons';
    let activeArmoryCategory = 'weapons';
    let selectedForgeItemId = '';
    let selectedArmorySlotId = '';

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
        return { ownedGearIds: [], ownedToolIds: [], equipped: {}, gearProgress: {} };
    }

    function normalizeGearProgress(raw) {
        const progress = {};
        if (!raw || typeof raw !== 'object') return progress;
        Object.entries(raw).forEach(([itemId, entry]) => {
            const id = String(itemId || '').trim();
            if (!id || !GEAR_BY_ID[id]) return;
            const level = Math.max(1, Math.min(MAX_GEAR_LEVEL, Math.floor(Number(entry?.level) || 1)));
            const xp = Math.max(0, Math.floor(Number(entry?.xp) || 0));
            progress[id] = { level, xp };
        });
        return progress;
    }

    function mapLegacyGearId(itemId) {
        const id = String(itemId || '').trim();
        return LEGACY_GEAR_ID_MAP[id] || id;
    }

    function mapLegacyToolId(toolId) {
        const id = String(toolId || '').trim();
        return LEGACY_TOOL_ID_MAP[id] || id;
    }

    function migrateGearProgressEntry(state, fromId, toId) {
        if (!fromId || !toId || fromId === toId) return;
        if (!state.gearProgress || typeof state.gearProgress !== 'object') return;
        const source = state.gearProgress[fromId];
        if (!source) return;
        const target = state.gearProgress[toId];
        if (!target || (source.level || 1) > (target.level || 1)) {
            state.gearProgress[toId] = { level: source.level, xp: source.xp };
        }
        delete state.gearProgress[fromId];
    }

    function migrateGearState(state) {
        if (!state || typeof state !== 'object') return state;

        state.ownedGearIds = [...new Set(
            (state.ownedGearIds || [])
                .map(mapLegacyGearId)
                .filter((id) => GEAR_BY_ID[id])
        )];

        state.ownedToolIds = [...new Set(
            (state.ownedToolIds || [])
                .map(mapLegacyToolId)
                .filter((id) => TOOL_BY_ID[id])
        )];

        const nextEquipped = {};
        Object.entries(state.equipped || {}).forEach(([slot, itemId]) => {
            const mapped = mapLegacyGearId(itemId);
            if (mapped && GEAR_BY_ID[mapped]) {
                migrateGearProgressEntry(state, String(itemId || '').trim(), mapped);
                nextEquipped[slot] = mapped;
            }
        });
        state.equipped = nextEquipped;

        Object.keys(state.gearProgress || {}).forEach((itemId) => {
            const mapped = mapLegacyGearId(itemId);
            if (!GEAR_BY_ID[mapped]) {
                delete state.gearProgress[itemId];
                return;
            }
            if (mapped !== itemId) {
                migrateGearProgressEntry(state, itemId, mapped);
            }
        });

        return state;
    }

    function readState() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return createDefaultState();
            const parsed = JSON.parse(raw);
            return migrateGearState({
                ownedGearIds: Array.isArray(parsed?.ownedGearIds)
                    ? [...new Set(parsed.ownedGearIds.map((id) => String(id || '').trim()).filter(Boolean))]
                    : [],
                ownedToolIds: Array.isArray(parsed?.ownedToolIds)
                    ? [...new Set(parsed.ownedToolIds.map((id) => String(id || '').trim()).filter(Boolean))]
                    : [],
                equipped: parsed?.equipped && typeof parsed.equipped === 'object' ? { ...parsed.equipped } : {},
                gearProgress: normalizeGearProgress(parsed?.gearProgress)
            });
        } catch (_error) {
            return createDefaultState();
        }
    }

    function writeState(state) {
        const next = {
            ownedGearIds: [...new Set((state?.ownedGearIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            ownedToolIds: [...new Set((state?.ownedToolIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            equipped: state?.equipped && typeof state.equipped === 'object' ? { ...state.equipped } : {},
            gearProgress: normalizeGearProgress(state?.gearProgress)
        };
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            syncPlayerGearSlots(next.equipped);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function resolveXpForNextLevel(level) {
        const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
        return 60 + currentLevel * 40;
    }

    function ensureGearProgress(state, itemId) {
        const id = String(itemId || '').trim();
        if (!id) return { level: 1, xp: 0 };
        if (!state.gearProgress || typeof state.gearProgress !== 'object') {
            state.gearProgress = {};
        }
        if (!state.gearProgress[id]) {
            state.gearProgress[id] = { level: 1, xp: 0 };
        }
        const entry = state.gearProgress[id];
        entry.level = Math.max(1, Math.min(MAX_GEAR_LEVEL, Math.floor(Number(entry.level) || 1)));
        entry.xp = Math.max(0, Math.floor(Number(entry.xp) || 0));
        return entry;
    }

    function resolveGearProgress(state, itemId) {
        const id = String(itemId || '').trim();
        if (!id) return { level: 1, xp: 0 };
        const entry = state?.gearProgress?.[id];
        if (!entry) return { level: 1, xp: 0 };
        return {
            level: Math.max(1, Math.min(MAX_GEAR_LEVEL, Math.floor(Number(entry.level) || 1))),
            xp: Math.max(0, Math.floor(Number(entry.xp) || 0))
        };
    }

    function formatGearLevelLabel(level) {
        return `Lv. ${Math.max(1, Math.floor(Number(level) || 1))}`;
    }

    function formatGearXpProgress(state, itemId) {
        const progress = resolveGearProgress(state, itemId);
        if (progress.level >= MAX_GEAR_LEVEL) return 'Max level';
        const needed = resolveXpForNextLevel(progress.level);
        return `${progress.xp} / ${needed} XP`;
    }

    function resolveArmoryUpgradeMinLevel(slot) {
        return BATTLE_XP_SLOTS.has(String(slot || '').trim()) ? ARMORY_UPGRADE_MIN_LEVEL : 1;
    }

    function applyGearXpGain(state, itemId, xpGain) {
        const item = GEAR_BY_ID[String(itemId || '').trim()];
        if (!item || !BATTLE_XP_SLOTS.has(item.slot)) return [];

        const gain = Math.max(0, Math.floor(Number(xpGain) || 0));
        if (!gain) return [];

        const entry = ensureGearProgress(state, item.id);
        if (entry.level >= MAX_GEAR_LEVEL) return [];

        entry.xp += gain;
        const levelUps = [];

        while (entry.level < MAX_GEAR_LEVEL) {
            const needed = resolveXpForNextLevel(entry.level);
            if (entry.xp < needed) break;
            entry.xp -= needed;
            const fromLevel = entry.level;
            entry.level += 1;
            levelUps.push({
                itemId: item.id,
                itemName: item.name,
                slot: item.slot,
                fromLevel,
                toLevel: entry.level,
                mark: SLOT_MARKS[item.slot] || '•'
            });
        }

        if (entry.level >= MAX_GEAR_LEVEL) {
            entry.xp = 0;
        }

        return levelUps;
    }

    function transferGearProgress(state, fromItemId, toItemId) {
        const fromId = String(fromItemId || '').trim();
        const toId = String(toItemId || '').trim();
        if (!fromId || !toId || fromId === toId) return;
        if (!state.gearProgress || typeof state.gearProgress !== 'object') {
            state.gearProgress = {};
        }
        const source = resolveGearProgress(state, fromId);
        state.gearProgress[toId] = { level: source.level, xp: source.xp };
    }

    function resolveBattleXpGain(winner) {
        const outcome = String(winner || 'npc').trim().toLowerCase();
        if (outcome === 'commander' || outcome === 'player') return BATTLE_XP_BY_OUTCOME.commander;
        if (outcome === 'draw' || outcome === 'tie') return BATTLE_XP_BY_OUTCOME.draw;
        return BATTLE_XP_BY_OUTCOME.npc;
    }

    function grantBattleXpFromTraining(battleResult) {
        const xpGain = resolveBattleXpGain(battleResult?.winner);
        if (!xpGain) return [];

        const state = readState();
        const levelUps = [];
        let xpApplied = false;

        Object.entries(state.equipped || {}).forEach(([_slot, itemId]) => {
            const item = GEAR_BY_ID[String(itemId || '').trim()];
            if (!item || !BATTLE_XP_SLOTS.has(item.slot)) return;
            xpApplied = true;
            const itemLevelUps = applyGearXpGain(state, itemId, xpGain);
            if (itemLevelUps.length) levelUps.push(...itemLevelUps);
        });

        if (!xpApplied) return [];

        writeState(state);
        global.dispatchEvent(new CustomEvent('royalarmies:age-gear-progress-updated', {
            detail: { levelUps, xpGain }
        }));

        if (levelUps.length) {
            enqueueGearLevelUps(levelUps);
        }

        return levelUps;
    }

    function ensureGearLevelUpOverlay() {
        let overlay = global.document.getElementById('age-gear-level-up-overlay');
        if (overlay) return overlay;

        overlay = global.document.createElement('div');
        overlay.id = 'age-gear-level-up-overlay';
        overlay.className = 'age-rank-promotion-overlay age-gear-level-up-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'age-gear-level-up-title');
        overlay.innerHTML = (
            '<div class="age-rank-promotion-card age-gear-level-up-card">'
            + '<p class="age-rank-promotion-eyebrow">Equipment Mastery</p>'
            + '<h2 id="age-gear-level-up-title" class="age-rank-promotion-title">Level Up!</h2>'
            + '<p id="age-gear-level-up-item" class="age-gear-level-up-item-line"></p>'
            + '<p id="age-gear-level-up-levels" class="age-gear-level-up-levels-line"></p>'
            + '<p id="age-gear-level-up-detail" class="age-rank-promotion-detail"></p>'
            + '<div class="age-rank-promotion-actions">'
            + '<button type="button" id="age-gear-level-up-dismiss" class="age-rank-promotion-btn age-rank-promotion-btn--continue">Continue</button>'
            + '</div>'
            + '</div>'
        );
        global.document.body.appendChild(overlay);
        return overlay;
    }

    function bindGearLevelUpOverlayHandlers() {
        if (gearLevelUpOverlayBound) return;
        gearLevelUpOverlayBound = true;
        global.document.addEventListener('click', (event) => {
            if (event.target.closest('#age-gear-level-up-dismiss')) {
                event.preventDefault();
                dismissGearLevelUpPopup();
            }
        });
        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const overlay = global.document.getElementById('age-gear-level-up-overlay');
            if (!overlay || overlay.hidden) return;
            event.preventDefault();
            dismissGearLevelUpPopup();
        });
    }

    function dismissGearLevelUpPopup() {
        const overlay = global.document.getElementById('age-gear-level-up-overlay');
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('age-gear-level-up-open');
        gearLevelUpShowing = false;
        global.setTimeout(pumpGearLevelUpQueue, 120);
    }

    function showGearLevelUpPopup(levelUp) {
        if (!levelUp) return;
        bindGearLevelUpOverlayHandlers();
        const overlay = ensureGearLevelUpOverlay();
        const itemEl = global.document.getElementById('age-gear-level-up-item');
        const levelsEl = global.document.getElementById('age-gear-level-up-levels');
        const detailEl = global.document.getElementById('age-gear-level-up-detail');

        if (itemEl) {
            itemEl.textContent = `${levelUp.mark || '•'} ${levelUp.itemName || 'Equipment'}`;
        }
        if (levelsEl) {
            levelsEl.innerHTML = `Reached <strong>${formatGearLevelLabel(levelUp.toLevel)}</strong> `
                + `(from ${formatGearLevelLabel(levelUp.fromLevel)})`;
        }
        if (detailEl) {
            const minLevel = resolveArmoryUpgradeMinLevel(levelUp.slot);
            if (levelUp.toLevel >= minLevel && minLevel > 1) {
                detailEl.textContent = 'This piece is now eligible for Armory upgrades.';
            } else if (levelUp.toLevel < MAX_GEAR_LEVEL) {
                const needed = resolveXpForNextLevel(levelUp.toLevel);
                detailEl.textContent = `Keep fighting with this gear equipped to reach the next level (${needed} XP needed).`;
            } else {
                detailEl.textContent = 'This piece has reached maximum mastery.';
            }
        }

        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-gear-level-up-open');
        gearLevelUpShowing = true;
        global.document.getElementById('age-gear-level-up-dismiss')?.focus();
    }

    function pumpGearLevelUpQueue() {
        if (gearLevelUpShowing || !gearLevelUpQueue.length) return;
        if (global.document.body.classList.contains('age-rank-promotion-open')) {
            global.setTimeout(pumpGearLevelUpQueue, 350);
            return;
        }
        showGearLevelUpPopup(gearLevelUpQueue.shift());
    }

    function enqueueGearLevelUps(levelUps) {
        if (!Array.isArray(levelUps) || !levelUps.length) return;
        gearLevelUpQueue.push(...levelUps);
        pumpGearLevelUpQueue();
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

    function resolveCommanderClassLabel() {
        const classId = resolveCommanderClassId();
        return classId === 'battlemage' ? 'Battlemage' : 'Battlemaster';
    }

    function syncGearShopCommanderStatus(prefix) {
        const statusEl = global.document.getElementById(`${prefix}-commander-status`);
        if (!statusEl) return;
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const meta = rankTitles?.resolveSelfCommanderRankMeta?.() || {};
        const rank = resolveCommanderRank();
        const rankLabel = rankTitles?.formatCommanderRankLabel
            ? rankTitles.formatCommanderRankLabel(rank, meta.path, meta.rankTitleGender)
            : `Rank ${rank}`;
        statusEl.textContent = `${resolveCommanderClassLabel()} · ${rankLabel}`;
    }

    function buildGearShopShellHtml(mode) {
        const prefix = mode === 'armory' ? 'age-armory-shop' : 'age-gear-shop';
        return (
            `<div class="age-gear-shop-workspace age-barracks-workspace" data-gear-shop-mode="${escapeHtml(mode)}">`
            + '<div class="age-barracks-body age-army-workspace-body">'
            + '<div class="age-barracks-layout">'
            + `<nav id="${prefix}-category-nav" class="age-barracks-category-nav age-army-workspace-panel" aria-label="Gear categories"></nav>`
            + '<div class="age-barracks-main">'
            + '<div class="age-barracks-main-head age-army-workspace-toolbar">'
            + '<div>'
            + `<h3 id="${prefix}-active-category-label" class="age-barracks-active-category-label age-army-workspace-panel-title">Weapons</h3>`
            + `<p id="${prefix}-commander-status" class="age-barracks-commander-status" aria-live="polite"></p>`
            + '</div>'
            + '<p class="age-barracks-main-hint age-army-workspace-toolbar-note">Select gear for stats, mastery, and pricing.</p>'
            + '</div>'
            + '<div class="age-barracks-main-split age-army-workspace-split">'
            + '<section class="age-barracks-unit-list-panel age-army-workspace-panel">'
            + `<div id="${prefix}-item-grid" class="age-barracks-unit-grid age-gear-shop-item-grid" aria-live="polite"></div>`
            + '</section>'
            + `<aside id="${prefix}-item-detail" class="age-barracks-unit-detail age-army-workspace-panel" hidden aria-live="polite"></aside>`
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '<p id="age-gear-shop-status" class="age-defense-workspace-status" aria-live="polite" hidden></p>'
            + '</div>'
        );
    }

    function resolveForgeCatalog() {
        return GEAR_CATALOG.filter((item) => item.classId === 'commander');
    }

    function resolveForgeCategoryItems(categoryId) {
        const category = FORGE_CATEGORIES.find((entry) => entry.id === categoryId);
        if (!category) return [];
        if (category.isTools) return FORGE_TOOLS;
        return resolveForgeCatalog().filter((item) => category.slots.includes(item.slot));
    }

    function resolveArmoryUpgrades(equipped, state) {
        const paths = ARMORY_UPGRADE_PATHS.commander || {};
        const gearState = state || readState();
        const upgrades = [];
        Object.entries(equipped || {}).forEach(([slot, itemId]) => {
            const currentId = mapLegacyGearId(itemId);
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
                statGain: formatStatSummary(next.stats),
                minUpgradeLevel: resolveArmoryUpgradeMinLevel(slot),
                currentLevel: resolveGearProgress(gearState, currentId).level
            });
        });
        return upgrades;
    }

    function resolveArmoryCategoryUpgrades(categoryId, state) {
        const category = ARMORY_CATEGORIES.find((entry) => entry.id === categoryId);
        if (!category) return [];
        const equipped = state?.equipped || readState().equipped;
        return resolveArmoryUpgrades(equipped, state).filter((entry) => category.slots.includes(entry.slot));
    }

    function renderGearCategoryNav(categories, activeCategoryId, attrName, navId) {
        const nav = global.document.getElementById(navId);
        if (!nav) return;
        nav.innerHTML = (
            '<p class="age-army-workspace-panel-title age-barracks-category-nav-title">Equipment</p>'
            + categories.map((category) => {
                const isActive = category.id === activeCategoryId;
                return (
                    `<button type="button"`
                    + ` class="age-barracks-category-btn${isActive ? ' is-active' : ''}"`
                    + ` ${attrName}="${escapeHtml(category.id)}"`
                    + ` aria-pressed="${isActive ? 'true' : 'false'}">`
                    + `<span class="age-barracks-category-label">${escapeHtml(category.label)}</span>`
                    + '</button>'
                );
            }).join('')
        );
    }

    function formatItemCardMeta(item, state, rank, options = {}) {
        const owned = options.isTool
            ? resolveOwnedToolSet(state).has(item.id)
            : resolveOwnedGearSet(state).has(item.id);
        const equipped = !options.isTool && isEquipped(state, item.id);
        const parts = [];
        if (equipped) parts.push('Equipped');
        else if (owned) parts.push('Owned');
        else parts.push(`${formatGold(item.purchaseGold)} gold`);
        if (!options.isTool && (owned || equipped) && BATTLE_XP_SLOTS.has(item.slot)) {
            const progress = resolveGearProgress(state, item.id);
            parts.push(formatGearLevelLabel(progress.level));
        }
        if (!owned && rank < item.equipMinRank) {
            parts.push(`Equip ${resolveRankThresholdLabel(item.equipMinRank)}`);
        }
        return parts.join(' · ');
    }

    function renderForgeItemCard(item, state, rank, isTool) {
        const isActive = selectedForgeItemId === item.id;
        const owned = isTool ? resolveOwnedToolSet(state).has(item.id) : resolveOwnedGearSet(state).has(item.id);
        const equipped = !isTool && isEquipped(state, item.id);
        const mark = isTool ? (item.mark || '⚙') : (SLOT_MARKS[item.slot] || '•');
        const meta = formatItemCardMeta(item, state, rank, { isTool });
        const locked = !owned && rank < item.equipMinRank;
        return (
            `<button type="button"`
            + ` class="age-barracks-unit-card age-gear-shop-item-card${isActive ? ' is-active' : ''}${locked && !owned ? ' is-locked' : ''}${equipped ? ' is-equipped' : ''}"`
            + ` data-gear-shop-item="${escapeHtml(item.id)}"`
            + ` aria-pressed="${isActive ? 'true' : 'false'}">`
            + `<span class="age-gear-shop-item-mark" aria-hidden="true">${escapeHtml(mark)}</span>`
            + '<span class="age-barracks-unit-card-body">'
            + `<span class="age-barracks-unit-card-name">${escapeHtml(item.name)}</span>`
            + `<span class="age-barracks-unit-card-meta">${escapeHtml(meta)}</span>`
            + '</span>'
            + '</button>'
        );
    }

    function renderArmoryUpgradeCard(upgrade, rank) {
        const isActive = selectedArmorySlotId === upgrade.slot;
        const meetsLevel = upgrade.currentLevel >= upgrade.minUpgradeLevel;
        const canUpgradeRank = rank >= upgrade.next.equipMinRank;
        const locked = !meetsLevel || !canUpgradeRank;
        const metaParts = [
            `${formatGold(upgrade.upgradeGold)} gold`,
            formatGearLevelLabel(upgrade.currentLevel),
            locked ? 'Locked' : 'Ready'
        ];
        return (
            `<button type="button"`
            + ` class="age-barracks-unit-card age-gear-shop-item-card${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}"`
            + ` data-armory-slot="${escapeHtml(upgrade.slot)}"`
            + ` aria-pressed="${isActive ? 'true' : 'false'}">`
            + `<span class="age-gear-shop-item-mark" aria-hidden="true">${escapeHtml(SLOT_MARKS[upgrade.slot] || '⧉')}</span>`
            + '<span class="age-barracks-unit-card-body">'
            + `<span class="age-barracks-unit-card-name">${escapeHtml(upgrade.current.name)}</span>`
            + `<span class="age-barracks-unit-card-meta">${escapeHtml(metaParts.join(' · '))}</span>`
            + '</span>'
            + '</button>'
        );
    }

    function renderForgeActionPanel(item, state, rank, isTool) {
        const owned = isTool ? resolveOwnedToolSet(state).has(item.id) : resolveOwnedGearSet(state).has(item.id);
        const equipped = !isTool && isEquipped(state, item.id);
        const canEquip = rank >= item.equipMinRank;
        const gold = resolveGold();
        const canAfford = gold >= item.purchaseGold;

        if (equipped) {
            return '<div class="age-gear-shop-detail-actions"><span class="age-defense-upgrade-status">Equipped</span></div>';
        }
        if (owned && !isTool) {
            if (!canEquip) {
                return `<div class="age-gear-shop-detail-actions"><span class="age-defense-upgrade-status">Equip at ${escapeHtml(resolveRankThresholdLabel(item.equipMinRank))}</span></div>`;
            }
            return (
                '<div class="age-gear-shop-detail-actions">'
                + `<button type="button" class="age-barracks-purchase-btn is-ready" data-forge-equip="${escapeHtml(item.id)}">Equip</button>`
                + '</div>'
            );
        }
        if (owned && isTool) {
            return '<div class="age-gear-shop-detail-actions"><span class="age-defense-upgrade-status">Owned</span></div>';
        }
        const purchaseAttr = isTool ? 'data-forge-tool-purchase' : 'data-forge-purchase';
        const disabled = canAfford ? '' : ' disabled';
        return (
            '<div class="age-gear-shop-detail-actions">'
            + `<button type="button" class="age-barracks-purchase-btn${canAfford ? ' is-ready' : ''}" ${purchaseAttr}="${escapeHtml(item.id)}"${disabled}>`
            + `Purchase — ${escapeHtml(formatGold(item.purchaseGold))}`
            + '</button>'
            + '</div>'
        );
    }

    function renderForgeItemDetail(item, state, rank, isTool) {
        const panel = global.document.getElementById('age-gear-shop-item-detail');
        if (!panel) return;
        if (!item) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }

        const mark = isTool ? (item.mark || '⚙') : (SLOT_MARKS[item.slot] || '•');
        const statsLine = formatStatSummary(item.stats);
        const progress = !isTool && BATTLE_XP_SLOTS.has(item.slot)
            ? resolveGearProgress(state, item.id)
            : null;
        const tierLine = !isTool && item.tier
            ? `<p class="age-gear-shop-detail-tier">Tier ${escapeHtml(item.tier)} · ${escapeHtml(item.rarity || 'common')}</p>`
            : '';
        const masteryLine = progress
            ? `<p class="age-gear-shop-detail-mastery">${escapeHtml(formatGearLevelLabel(progress.level))}`
                + (progress.level < MAX_GEAR_LEVEL
                    ? ` · ${escapeHtml(formatGearXpProgress(state, item.id))}`
                    : ' · Max level')
                + '</p>'
            : '';

        panel.hidden = false;
        panel.innerHTML = (
            '<div class="age-gear-shop-detail-inner">'
            + '<div class="age-gear-shop-detail-header">'
            + `<span class="age-gear-shop-detail-mark" aria-hidden="true">${escapeHtml(mark)}</span>`
            + '<div class="age-gear-shop-detail-summary">'
            + `<h3 class="age-barracks-detail-title">${escapeHtml(item.name)}</h3>`
            + tierLine
            + `<p class="age-gear-shop-detail-desc">${escapeHtml(item.desc)}</p>`
            + (statsLine ? `<p class="age-gear-shop-detail-stats">${escapeHtml(statsLine)}</p>` : '')
            + masteryLine
            + '</div>'
            + '</div>'
            + renderForgeActionPanel(item, state, rank, isTool)
            + '</div>'
        );
    }

    function renderArmoryItemDetail(upgrade, rank) {
        const panel = global.document.getElementById('age-armory-shop-item-detail');
        if (!panel) return;
        if (!upgrade) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }

        const meetsLevel = upgrade.currentLevel >= upgrade.minUpgradeLevel;
        const canUpgradeRank = rank >= upgrade.next.equipMinRank;
        const gold = resolveGold();
        const canAfford = gold >= upgrade.upgradeGold;
        const canUpgrade = meetsLevel && canUpgradeRank;
        const gate = !meetsLevel
            ? `Requires ${formatGearLevelLabel(upgrade.minUpgradeLevel)} (currently ${formatGearLevelLabel(upgrade.currentLevel)})`
            : (!canUpgradeRank ? `Requires ${resolveRankThresholdLabel(upgrade.next.equipMinRank)}` : '');

        panel.hidden = false;
        panel.innerHTML = (
            '<div class="age-gear-shop-detail-inner">'
            + '<div class="age-gear-shop-detail-header">'
            + `<span class="age-gear-shop-detail-mark" aria-hidden="true">${escapeHtml(SLOT_MARKS[upgrade.slot] || '⧉')}</span>`
            + '<div class="age-gear-shop-detail-summary">'
            + `<h3 class="age-barracks-detail-title">${escapeHtml(upgrade.current.name)} → ${escapeHtml(upgrade.next.name)}</h3>`
            + `<p class="age-gear-shop-detail-desc">Upgrade equipped gear for improved battle stats. Fight in the Adventurers Guild to raise mastery before upgrading weapons and armor.</p>`
            + `<p class="age-gear-shop-detail-stats">Gain: ${escapeHtml(upgrade.statGain || 'Improved battle stats')}</p>`
            + `<p class="age-gear-shop-detail-mastery">${escapeHtml(formatGearLevelLabel(upgrade.currentLevel))} · ${escapeHtml(formatGearXpProgress(readState(), upgrade.current.id))}</p>`
            + (gate ? `<p class="age-gear-shop-detail-lock">${escapeHtml(gate)}</p>` : '')
            + '</div>'
            + '</div>'
            + (
                canUpgrade
                    ? (
                        '<div class="age-gear-shop-detail-actions">'
                        + `<button type="button" class="age-barracks-purchase-btn${canAfford ? ' is-ready' : ''}" data-armory-upgrade="${escapeHtml(upgrade.slot)}"${canAfford ? '' : ' disabled'}>`
                        + `Upgrade — ${escapeHtml(formatGold(upgrade.upgradeGold))}`
                        + '</button>'
                        + '</div>'
                    )
                    : `<div class="age-gear-shop-detail-actions"><span class="age-defense-upgrade-status">${escapeHtml(gate || 'Locked')}</span></div>`
            )
            + '</div>'
        );
    }

    function refreshForgeShopUi() {
        const grid = global.document.getElementById('age-gear-shop-item-grid');
        if (!grid) return;

        const state = readState();
        const rank = resolveCommanderRank();
        const category = FORGE_CATEGORIES.find((entry) => entry.id === activeForgeCategory) || FORGE_CATEGORIES[0];
        const isTools = Boolean(category.isTools);
        const items = resolveForgeCategoryItems(activeForgeCategory);

        syncGearShopCommanderStatus('age-gear-shop');
        const labelEl = global.document.getElementById('age-gear-shop-active-category-label');
        if (labelEl) labelEl.textContent = category.label;
        renderGearCategoryNav(FORGE_CATEGORIES, activeForgeCategory, 'data-gear-shop-category', 'age-gear-shop-category-nav');

        if (!items.length) {
            grid.innerHTML = '<p class="age-barracks-empty">No gear listed in this category yet.</p>';
            renderForgeItemDetail(null);
            return;
        }

        if (!selectedForgeItemId || !items.some((item) => item.id === selectedForgeItemId)) {
            selectedForgeItemId = items[0].id;
        }

        grid.innerHTML = items.map((item) => renderForgeItemCard(item, state, rank, isTools)).join('');
        const selected = items.find((item) => item.id === selectedForgeItemId);
        renderForgeItemDetail(selected, state, rank, isTools);
    }

    function refreshArmoryShopUi() {
        const grid = global.document.getElementById('age-armory-shop-item-grid');
        if (!grid) return;

        const state = readState();
        const rank = resolveCommanderRank();
        const category = ARMORY_CATEGORIES.find((entry) => entry.id === activeArmoryCategory) || ARMORY_CATEGORIES[0];
        const upgrades = resolveArmoryCategoryUpgrades(activeArmoryCategory, state);

        syncGearShopCommanderStatus('age-armory-shop');
        const labelEl = global.document.getElementById('age-armory-shop-active-category-label');
        if (labelEl) labelEl.textContent = category.label;
        renderGearCategoryNav(ARMORY_CATEGORIES, activeArmoryCategory, 'data-armory-category', 'age-armory-shop-category-nav');

        if (!upgrades.length) {
            grid.innerHTML = '<p class="age-barracks-empty">No upgrades ready in this category. Equip forge gear, then return once it reaches the required mastery level.</p>';
            renderArmoryItemDetail(null);
            return;
        }

        if (!selectedArmorySlotId || !upgrades.some((entry) => entry.slot === selectedArmorySlotId)) {
            selectedArmorySlotId = upgrades[0].slot;
        }

        grid.innerHTML = upgrades.map((entry) => renderArmoryUpgradeCard(entry, rank)).join('');
        const selected = upgrades.find((entry) => entry.slot === selectedArmorySlotId);
        renderArmoryItemDetail(selected, rank);
    }

    function renderForgeBody() {
        return buildGearShopShellHtml('forge');
    }

    function renderArmoryBody() {
        return buildGearShopShellHtml('armory');
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
            bodyEl.classList.add('is-gear-shop-layout');
            if (!bodyEl.querySelector('[data-gear-shop-mode="forge"]')) {
                bodyEl.innerHTML = renderForgeBody();
            }
            refreshForgeShopUi();
        } else if (activeVenueId === 'armory') {
            bodyEl.classList.add('is-gear-shop-layout');
            if (!bodyEl.querySelector('[data-gear-shop-mode="armory"]')) {
                bodyEl.innerHTML = renderArmoryBody();
            }
            refreshArmoryShopUi();
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
        ensureGearProgress(state, item.id);
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
        ensureGearProgress(state, item.id);
        writeState(state);
        setShopStatus(`${item.name} equipped.`);
        return true;
    }

    function upgradeArmorySlot(slotId) {
        const slot = String(slotId || '').trim();
        const state = readState();
        const currentId = mapLegacyGearId(state.equipped?.[slot]);
        const paths = ARMORY_UPGRADE_PATHS.commander || {};
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
        const progress = resolveGearProgress(state, currentId);
        const minLevel = resolveArmoryUpgradeMinLevel(slot);
        if (progress.level < minLevel) {
            setShopStatus(`${current.name} must reach ${formatGearLevelLabel(minLevel)} before upgrading (currently ${formatGearLevelLabel(progress.level)}).`, true);
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
        transferGearProgress(state, currentId, next.id);
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

    function onGearShopUiClick(event, activeVenueId) {
        if (activeVenueId === 'blacksmith') {
            const categoryBtn = event.target.closest('[data-gear-shop-category]');
            if (categoryBtn) {
                event.preventDefault();
                activeForgeCategory = categoryBtn.getAttribute('data-gear-shop-category') || 'weapons';
                selectedForgeItemId = '';
                refreshForgeShopUi();
                return true;
            }

            const itemBtn = event.target.closest('[data-gear-shop-item]');
            if (itemBtn) {
                event.preventDefault();
                selectedForgeItemId = itemBtn.getAttribute('data-gear-shop-item') || '';
                refreshForgeShopUi();
                return true;
            }
        }

        if (activeVenueId === 'armory') {
            const categoryBtn = event.target.closest('[data-armory-category]');
            if (categoryBtn) {
                event.preventDefault();
                activeArmoryCategory = categoryBtn.getAttribute('data-armory-category') || 'weapons';
                selectedArmorySlotId = '';
                refreshArmoryShopUi();
                return true;
            }

            const slotBtn = event.target.closest('[data-armory-slot]');
            if (slotBtn) {
                event.preventDefault();
                selectedArmorySlotId = slotBtn.getAttribute('data-armory-slot') || '';
                refreshArmoryShopUi();
                return true;
            }
        }

        return false;
    }

    function onGearShopClick(event, activeVenueId) {
        if (activeVenueId !== 'blacksmith' && activeVenueId !== 'armory') return false;
        if (onGearShopUiClick(event, activeVenueId)) return true;

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
        global.addEventListener('royalarmies:age-gear-progress-updated', () => {
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
        ARMORY_UPGRADE_MIN_LEVEL,
        MAX_GEAR_LEVEL,
        renderForgeBody,
        renderArmoryBody,
        onGearShopClick,
        resolveEquipmentRankLockReason,
        resolveForgeEyebrow,
        resolveArmoryEyebrow,
        refreshActiveBody,
        readState,
        writeState,
        grantBattleXpFromTraining,
        resolveGearProgress,
        formatGearLevelLabel
    });
})(window);

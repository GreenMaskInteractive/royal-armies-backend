/**
 * RIFT — Forge (Blacksmith) purchases & Armory gold upgrades for commander gear.
 */
(function initRoyalArmiesAgeGearShop(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-gear-shop-state';
    const EQUIPMENT_MIN_RANK = 2;
    const MAX_GEAR_LEVEL = 15;
    const ARMORY_UPGRADE_MIN_LEVEL = 5;
    const INVENTORY_MAX_SLOTS = 30;
    const INVENTORY_START_UNLOCKED = 10;
    const TRAINING_PANEL_PREFIX = 'age-guild-training';

    const TRAINING_GEAR_SLOT_ORDER = Object.freeze([
        { id: 'head', label: 'Head' },
        { id: 'mainHand', label: 'Main Hand' },
        { id: 'offHand', label: 'Off Hand' },
        { id: 'chest', label: 'Chest' },
        { id: 'hands', label: 'Hands' },
        { id: 'legs', label: 'Legs' },
        { id: 'feet', label: 'Feet' },
        { id: 'cloak', label: 'Cloak' },
        { id: 'ring', label: 'Ring' },
        { id: 'amulet', label: 'Amulet' }
    ]);

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

    const GEAR_SLOT_LABELS = Object.freeze({
        mainHand: 'Main Hand',
        offHand: 'Off Hand',
        head: 'Head',
        chest: 'Chest',
        hands: 'Hands',
        legs: 'Legs',
        feet: 'Feet',
        cloak: 'Cloak',
        ring: 'Ring',
        amulet: 'Amulet'
    });

    const FORGE_SUBCATEGORIES = Object.freeze({
        weapons: { id: 'weapons', label: 'Weapons', imageSrc: 'images/forge/category-weapons.svg' },
        shields: { id: 'shields', label: 'Shields', imageSrc: 'images/forge/category-shields.svg' },
        bows: { id: 'bows', label: 'Bows', imageSrc: 'images/forge/category-bows.svg' },
        mounts: { id: 'mounts', label: 'Mounts', imageSrc: 'images/forge/category-mounts.svg' },
        helmets: { id: 'helmets', label: 'Helmets', imageSrc: 'images/forge/category-helmets.svg' },
        chest: { id: 'chest', label: 'Chest', imageSrc: 'images/forge/category-chest.svg' },
        gauntlets: { id: 'gauntlets', label: 'Gauntlets', imageSrc: 'images/forge/category-gauntlets.svg' },
        greaves: { id: 'greaves', label: 'Greaves', imageSrc: 'images/forge/category-greaves.svg' },
        footwear: { id: 'footwear', label: 'Footwear', imageSrc: 'images/forge/category-footwear.svg' },
        cloaks: { id: 'cloaks', label: 'Cloaks', imageSrc: 'images/forge/category-cloaks.svg' },
        rings: { id: 'rings', label: 'Rings', imageSrc: 'images/forge/category-rings.svg' },
        amulets: { id: 'amulets', label: 'Amulets', imageSrc: 'images/forge/category-amulets.svg' },
        tools: { id: 'tools', label: 'Tools & Kits', imageSrc: 'images/forge/category-tools.svg', isTools: true }
    });

    const FORGE_DEPARTMENTS = Object.freeze([
        {
            id: 'arms',
            label: 'Arms',
            subcategories: ['weapons', 'shields', 'bows', 'mounts']
        },
        {
            id: 'armor',
            label: 'Armor',
            subcategories: ['helmets', 'chest', 'gauntlets', 'greaves', 'footwear', 'cloaks']
        },
        {
            id: 'accessories',
            label: 'Accoutrements',
            subcategories: ['rings', 'amulets']
        },
        {
            id: 'field-kit',
            label: 'Field Kit',
            subcategories: ['tools']
        }
    ]);

    /** @deprecated legacy forge tabs — armory still uses FORGE_CATEGORIES shape via ARMORY_CATEGORIES */
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
            forgeCategory: 'tools',
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
            forgeCategory: 'tools',
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
            forgeCategory: 'tools',
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
            forgeCategory: 'tools',
            desc: 'Precision fittings and ward-stitch tools for commanders who blend steel and sigil craft.',
            stats: { ranged: 1, guildXp: 0.02 },
            purchaseGold: 1250,
            equipMinRank: 7
        }
    ]);

    const GEAR_CATALOG = Object.freeze([
        { id: 'cmd-ironheart-saber', name: 'Ironheart Saber', slot: 'mainHand', forgeCategory: 'weapons', handedness: 'oneHand', dualWieldOffHand: true, classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, morale: 1 }, purchaseGold: 800, equipMinRank: 2, desc: 'A balanced field blade suited to steel and spell alike. Dual-wield capable when paired with another one-handed blade.' },
        { id: 'cmd-warded-bulwark', name: 'Warded Bulwark', slot: 'offHand', forgeCategory: 'shields', offHandType: 'shield', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, ranged: 1, injuryMitigation: 0.02 }, purchaseGold: 650, equipMinRank: 2, desc: 'Shield lined with minor wards—steady for melee and channelers.' },
        { id: 'cmd-oathbound-visor', name: 'Oathbound Visor', slot: 'head', forgeCategory: 'helmets', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, injuryMitigation: 0.01 }, purchaseGold: 540, equipMinRank: 2, desc: 'Visor etched with dual-path oaths of the Royal Armies.' },
        { id: 'cmd-concord-mail', name: 'Concord Mail', slot: 'chest', forgeCategory: 'chest', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, injuryMitigation: 0.03 }, purchaseGold: 720, equipMinRank: 2, desc: 'Mail that flexes for sword-work and sigil-weave alike.' },
        { id: 'cmd-duelweave-gauntlets', name: 'Duelweave Gauntlets', slot: 'hands', forgeCategory: 'gauntlets', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, command: 1 }, purchaseGold: 430, equipMinRank: 2, desc: 'Threaded gauntlets for weapon grip and spell shaping.' },
        { id: 'cmd-marchward-greaves', name: 'Marchward Greaves', slot: 'legs', forgeCategory: 'greaves', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, command: 1, injuryMitigation: 0.01 }, purchaseGold: 460, equipMinRank: 2, desc: 'Greaves worn on every path through hostile territory.' },
        { id: 'cmd-pathfinder-treads', name: 'Pathfinder Treads', slot: 'feet', forgeCategory: 'footwear', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, injuryMitigation: 0.01, command: 1 }, purchaseGold: 380, equipMinRank: 2, desc: 'Boots that keep commanders sure-footed in melee or ritual march.' },
        { id: 'cmd-bannercloak-accord', name: 'Bannercloak of Accord', slot: 'cloak', forgeCategory: 'cloaks', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, guildXp: 0.02, morale: 1 }, purchaseGold: 560, equipMinRank: 2, desc: 'Guild-issue cloak signaling unity of physical and arcane companies.' },
        { id: 'cmd-covenant-signet', name: 'Covenant Signet', slot: 'ring', forgeCategory: 'rings', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 2 }, purchaseGold: 500, equipMinRank: 2, desc: 'Signet ring of shared command authority.' },
        { id: 'cmd-twinpath-talisman', name: 'Twinpath Talisman', slot: 'amulet', forgeCategory: 'amulets', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 2, injuryMitigation: 0.01 }, purchaseGold: 530, equipMinRank: 2, desc: 'Charm balancing resolve for blade and spell commanders.' },
        { id: 'cmd-sovereign-edge', name: "Sovereign's Edge", slot: 'mainHand', forgeCategory: 'weapons', handedness: 'oneHand', dualWieldOffHand: true, classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 4, ranged: 4, morale: 2 }, purchaseGold: 4400, equipMinRank: 7, desc: 'Masterwork edge for veteran officers. Dual-wield capable when paired with another one-handed blade.' },
        { id: 'cmd-bastion-two-paths', name: 'Bastion of Two Paths', slot: 'offHand', forgeCategory: 'shields', offHandType: 'shield', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, ranged: 1, injuryMitigation: 0.04 }, purchaseGold: 3700, equipMinRank: 7, desc: 'Reinforced ward-shield carried by herald-ranked commanders.' },
        { id: 'cmd-crownward-casque', name: 'Crownward Casque', slot: 'head', forgeCategory: 'helmets', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, injuryMitigation: 0.02 }, purchaseGold: 2900, equipMinRank: 7, desc: 'Tempered casque with riveted ward lines.' },
        { id: 'cmd-aegis-of-concord', name: 'Aegis of Concord', slot: 'chest', forgeCategory: 'chest', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 3, ranged: 3, injuryMitigation: 0.05 }, purchaseGold: 4000, equipMinRank: 7, desc: 'Plate-lined harness for front-line duty on any path.' },
        { id: 'cmd-warfinger-gauntlets', name: 'Warfinger Gauntlets', slot: 'hands', forgeCategory: 'gauntlets', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, command: 2 }, purchaseGold: 2650, equipMinRank: 7, desc: 'Tempered gauntlets for weapon mastery and spell control.' },
        { id: 'cmd-legionward-plates', name: 'Legionward Plates', slot: 'legs', forgeCategory: 'greaves', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, command: 2, injuryMitigation: 0.02 }, purchaseGold: 2550, equipMinRank: 7, desc: 'Veteran leg plates for long campaign marches.' },
        { id: 'cmd-ironpath-sabatons', name: 'Ironpath Sabatons', slot: 'feet', forgeCategory: 'footwear', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, injuryMitigation: 0.02 }, purchaseGold: 2350, equipMinRank: 7, desc: 'Reinforced march boots with warded soles.' },
        { id: 'cmd-marshal-pathcloak', name: "Marshal's Pathcloak", slot: 'cloak', forgeCategory: 'cloaks', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, guildXp: 0.04, morale: 2 }, purchaseGold: 3100, equipMinRank: 7, desc: 'Officer cloak threaded for guild recognition on both paths.' },
        { id: 'cmd-oathkeeper-band', name: "Oathkeeper's Band", slot: 'ring', forgeCategory: 'rings', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 3 }, purchaseGold: 2800, equipMinRank: 7, desc: 'Ring of a proven dual-path commander.' },
        { id: 'cmd-dualheart-amulet', name: 'Dualheart Amulet', slot: 'amulet', forgeCategory: 'amulets', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 3, injuryMitigation: 0.02, guildXp: 0.01 }, purchaseGold: 3000, equipMinRank: 7, desc: 'Battle charm carried by herald-ranked veterans.' },
        { id: 'gear-horn-rallying-dawn', name: 'Horn of Rallying Dawn', slot: 'mainHand', forgeCategory: 'weapons', handedness: 'twoHand', classId: 'commander', tier: 2, rarity: 'rare', battleEffect: 'signal-horn', stats: { command: 2, morale: 1, strength: 1, ranged: 1 }, purchaseGold: 6800, equipMinRank: 7, desc: 'Two-handed battle horn that marks priority targets in PvP.' },
        { id: 'gear-nullspike-harpoon', name: 'Nullspike Harpoon', slot: 'mainHand', forgeCategory: 'weapons', handedness: 'twoHand', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'mage-slayer-harpoon', stats: { strength: 3, ranged: 2 }, purchaseGold: 14200, equipMinRank: 14, desc: 'Two-handed anti-magic harpoon—high cost, requires rank 14 to wield.' },
        { id: 'gear-phoenix-interlock', name: 'Phoenix Interlock Plate', slot: 'chest', forgeCategory: 'chest', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'linked-resilient-plating', stats: { injuryMitigation: 0.05, strength: 2, ranged: 2 }, purchaseGold: 15800, equipMinRank: 14, desc: 'Elite linked plate harness for nation assaults.' },
        { id: 'gear-nullstone-palladium', name: 'Nullstone Palladium', slot: 'offHand', forgeCategory: 'shields', offHandType: 'shield', classId: 'commander', tier: 3, rarity: 'epic', battleEffect: 'null-stone-aegis', stats: { injuryMitigation: 0.04, morale: 2, command: 1 }, purchaseGold: 18500, equipMinRank: 18, desc: 'Null-stone ward shield. Equip at rank 18.' }
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

    const GearEquipRules = global.RoyalArmiesGearEquipRules || {};

    function resolveGearItemById(itemId) {
        return GEAR_BY_ID[String(itemId || '').trim()] || null;
    }

    function sanitizeLocalEquippedMap(equipped) {
        if (typeof GearEquipRules.sanitizeEquippedSlotMap === 'function') {
            return GearEquipRules.sanitizeEquippedSlotMap(equipped || {}, resolveGearItemById);
        }
        return equipped && typeof equipped === 'object' ? { ...equipped } : {};
    }

    function resolveEquipTargetSlot(item, equipped) {
        if (typeof GearEquipRules.resolveEquipTargetSlot === 'function') {
            return GearEquipRules.resolveEquipTargetSlot(item, equipped || {}, resolveGearItemById);
        }
        return String(item?.slot || '').trim();
    }

    function describeEquipFailure(reason) {
        if (typeof GearEquipRules.describeEquipSlotFailure === 'function') {
            return GearEquipRules.describeEquipSlotFailure(reason);
        }
        return 'That item cannot be equipped right now.';
    }

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
    let activeForgeDepartment = 'arms';
    let activeForgeSubcategory = 'weapons';
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
        return {
            ownedGearIds: [],
            ownedToolIds: [],
            equipped: {},
            gearProgress: {},
            inventorySlots: Array(INVENTORY_MAX_SLOTS).fill(null),
            inventoryUnlocked: INVENTORY_START_UNLOCKED
        };
    }

    function normalizeInventoryEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const type = String(entry.type || '').trim().toLowerCase();
        const itemId = type === 'tool'
            ? mapLegacyToolId(entry.itemId)
            : mapLegacyGearId(entry.itemId);
        if (!itemId) return null;
        if (type === 'tool') {
            return TOOL_BY_ID[itemId] ? { type: 'tool', itemId } : null;
        }
        if (type === 'gear') {
            return GEAR_BY_ID[itemId] ? { type: 'gear', itemId } : null;
        }
        return null;
    }

    function normalizeInventorySlots(rawSlots) {
        const slots = Array(INVENTORY_MAX_SLOTS).fill(null);
        if (!Array.isArray(rawSlots)) return slots;
        rawSlots.slice(0, INVENTORY_MAX_SLOTS).forEach((entry, index) => {
            slots[index] = normalizeInventoryEntry(entry);
        });
        return slots;
    }

    function ensureInventoryState(state) {
        if (!state || typeof state !== 'object') return state;
        state.inventorySlots = normalizeInventorySlots(state.inventorySlots);
        const unlocked = Math.floor(Number(state.inventoryUnlocked) || INVENTORY_START_UNLOCKED);
        state.inventoryUnlocked = Math.max(1, Math.min(INVENTORY_MAX_SLOTS, unlocked));
        return state;
    }

    function findFirstFreeInventorySlot(state) {
        ensureInventoryState(state);
        const unlocked = state.inventoryUnlocked;
        for (let index = 0; index < unlocked; index += 1) {
            if (!state.inventorySlots[index]) return index;
        }
        return -1;
    }

    function countInventoryItems(state) {
        ensureInventoryState(state);
        return state.inventorySlots
            .slice(0, state.inventoryUnlocked)
            .filter(Boolean)
            .length;
    }

    function inventoryHasItem(state, itemId, type) {
        ensureInventoryState(state);
        const id = String(itemId || '').trim();
        const kind = String(type || '').trim().toLowerCase();
        return state.inventorySlots.some((entry) => (
            entry
            && entry.itemId === id
            && (!kind || entry.type === kind)
        ));
    }

    function addToInventory(state, entry) {
        ensureInventoryState(state);
        const normalized = normalizeInventoryEntry(entry);
        if (!normalized) return false;
        const slotIndex = findFirstFreeInventorySlot(state);
        if (slotIndex < 0) return false;
        state.inventorySlots[slotIndex] = normalized;
        return true;
    }

    function removeInventorySlot(state, slotIndex) {
        ensureInventoryState(state);
        const index = Math.floor(Number(slotIndex));
        if (!Number.isFinite(index) || index < 0 || index >= state.inventoryUnlocked) return null;
        const entry = state.inventorySlots[index];
        state.inventorySlots[index] = null;
        return entry;
    }

    function migrateOrphanedItemsToInventory(state) {
        ensureInventoryState(state);
        const equippedIds = new Set(
            Object.values(state.equipped || {})
                .map((itemId) => mapLegacyGearId(itemId))
                .filter(Boolean)
        );
        const trackedIds = new Set();

        state.inventorySlots.forEach((entry) => {
            if (entry?.itemId) trackedIds.add(entry.itemId);
        });
        equippedIds.forEach((itemId) => trackedIds.add(itemId));

        (state.ownedGearIds || []).forEach((itemId) => {
            const id = mapLegacyGearId(itemId);
            if (!id || trackedIds.has(id)) return;
            if (addToInventory(state, { type: 'gear', itemId: id })) {
                trackedIds.add(id);
            }
        });

        (state.ownedToolIds || []).forEach((toolId) => {
            const id = mapLegacyToolId(toolId);
            if (!id || trackedIds.has(id)) return;
            if (addToInventory(state, { type: 'tool', itemId: id })) {
                trackedIds.add(id);
            }
        });
    }

    function canPlacePurchasedItem(state, item, isTool) {
        ensureInventoryState(state);
        if (!isTool) {
            const slot = resolveEquipTargetSlot(item, state.equipped);
            const currentEquipped = mapLegacyGearId(state.equipped?.[slot]);
            const rank = resolveCommanderRank();
            if (!currentEquipped && rank >= item.equipMinRank) {
                const check = GearEquipRules.canEquipGearItemToSlot
                    ? GearEquipRules.canEquipGearItemToSlot(item, slot, state.equipped, resolveGearItemById)
                    : { ok: true };
                if (check.ok) return true;
            }
        }
        return findFirstFreeInventorySlot(state) >= 0;
    }

    function placePurchasedItem(state, item, isTool) {
        ensureInventoryState(state);
        if (isTool) {
            state.ownedToolIds.push(item.id);
            const placed = addToInventory(state, { type: 'tool', itemId: item.id });
            return { placed: 'inventory', success: placed };
        }

        state.ownedGearIds.push(item.id);
        ensureGearProgress(state, item.id);

        const slot = resolveEquipTargetSlot(item, state.equipped);
        const currentEquipped = mapLegacyGearId(state.equipped?.[slot]);
        const rank = resolveCommanderRank();
        const slotCheck = GearEquipRules.canEquipGearItemToSlot
            ? GearEquipRules.canEquipGearItemToSlot(item, slot, state.equipped, resolveGearItemById)
            : { ok: true };

        if (!currentEquipped && rank >= item.equipMinRank && slotCheck.ok) {
            state.equipped[slot] = item.id;
            if (slot === 'mainHand' && item.handedness === 'twoHand' && state.equipped.offHand) {
                const offId = mapLegacyGearId(state.equipped.offHand);
                if (offId) addToInventory(state, { type: 'gear', itemId: offId });
                delete state.equipped.offHand;
            }
            return { placed: 'equipped', success: true, slot };
        }

        const placed = addToInventory(state, { type: 'gear', itemId: item.id });
        const reason = currentEquipped ? 'occupied' : 'rank';
        return { placed: 'inventory', success: placed, slot, reason };
    }

    function formatPurchasePlacementMessage(item, result, isTool) {
        if (!result?.success) return 'Inventory full — free a slot before purchasing.';
        if (result.placed === 'equipped') {
            const slotLabel = GEAR_SLOT_LABELS[result.slot] || result.slot || 'slot';
            return `${item.name} equipped to ${slotLabel}.`;
        }
        if (isTool) return `${item.name} stowed in your inventory.`;
        if (result.reason === 'occupied') {
            const slotLabel = GEAR_SLOT_LABELS[result.slot] || result.slot || 'slot';
            return `${item.name} stowed in inventory (${slotLabel} occupied).`;
        }
        if (result.reason === 'rank') {
            return `${item.name} stowed in inventory until ${resolveRankThresholdLabel(item.equipMinRank)}.`;
        }
        return `${item.name} stowed in your inventory.`;
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
        state.equipped = sanitizeLocalEquippedMap(nextEquipped);

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

        migrateOrphanedItemsToInventory(state);
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
                gearProgress: normalizeGearProgress(parsed?.gearProgress),
                inventorySlots: normalizeInventorySlots(parsed?.inventorySlots),
                inventoryUnlocked: parsed?.inventoryUnlocked
            });
        } catch (_error) {
            return createDefaultState();
        }
    }

    function writeState(state) {
        const migrated = migrateGearState({
            ownedGearIds: state?.ownedGearIds || [],
            ownedToolIds: state?.ownedToolIds || [],
            equipped: state?.equipped || {},
            gearProgress: state?.gearProgress || {},
            inventorySlots: state?.inventorySlots || [],
            inventoryUnlocked: state?.inventoryUnlocked
        });
        const next = {
            ownedGearIds: [...new Set((migrated?.ownedGearIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            ownedToolIds: [...new Set((migrated?.ownedToolIds || []).map((id) => String(id || '').trim()).filter(Boolean))],
            equipped: migrated?.equipped && typeof migrated.equipped === 'object' ? { ...migrated.equipped } : {},
            gearProgress: normalizeGearProgress(migrated?.gearProgress),
            inventorySlots: normalizeInventorySlots(migrated?.inventorySlots),
            inventoryUnlocked: migrated?.inventoryUnlocked || INVENTORY_START_UNLOCKED
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

    function formatGearStatToken(key, value) {
        const qty = Math.max(0, Number(value) || 0);
        if (!qty) return '';
        const label = STAT_LABELS[key] || key;
        if (key === 'injuryMitigation' || key === 'guildXp') {
            const pct = Math.round(qty * 1000) / 10;
            const scope = key === 'guildXp'
                ? ' (city assault & border PvP)'
                : ' (city assault & border PvP; not training)';
            return `+${pct}% ${label}${scope}`;
        }
        const rounded = Math.round(qty * 10) / 10;
        if (key === 'command') {
            return `+${rounded} ${label} (city assault & border PvP attack starting morale)`;
        }
        if (key === 'morale') {
            return `+${rounded} ${label} (morale shock & rout resistance — coming soon)`;
        }
        return `+${rounded} ${label}`;
    }

    function formatStatSummary(stats) {
        if (!stats || typeof stats !== 'object') return '';
        return Object.entries(stats)
            .map(([key, value]) => formatGearStatToken(key, value))
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
        const isForge = mode === 'forge';
        const splitClass = isForge
            ? 'age-barracks-main-split age-army-workspace-split age-gear-shop-forge-split'
            : 'age-barracks-main-split age-army-workspace-split';
        const detailClass = isForge
            ? 'age-barracks-unit-detail age-army-workspace-panel age-gear-shop-inspect-panel'
            : 'age-barracks-unit-detail age-army-workspace-panel';
        const hint = isForge
            ? 'Pick a department and category, then select gear to inspect.'
            : 'Select gear for stats, mastery, and pricing.';
        return (
            `<div class="age-gear-shop-workspace age-barracks-workspace" data-gear-shop-mode="${escapeHtml(mode)}">`
            + '<div class="age-barracks-body age-army-workspace-body">'
            + '<div class="age-barracks-layout">'
            + `<nav id="${prefix}-category-nav" class="age-barracks-category-nav age-army-workspace-panel${isForge ? ' age-gear-shop-forge-nav' : ''}" aria-label="Gear categories"></nav>`
            + '<div class="age-barracks-main">'
            + '<div class="age-barracks-main-head age-army-workspace-toolbar">'
            + '<div>'
            + `<h3 id="${prefix}-active-category-label" class="age-barracks-active-category-label age-army-workspace-panel-title">${isForge ? 'Weapons' : 'Weapons'}</h3>`
            + `<p id="${prefix}-commander-status" class="age-barracks-commander-status" aria-live="polite"></p>`
            + '</div>'
            + `<p class="age-barracks-main-hint age-army-workspace-toolbar-note">${escapeHtml(hint)}</p>`
            + '</div>'
            + `<div class="${splitClass}">`
            + '<section class="age-barracks-unit-list-panel age-army-workspace-panel age-gear-shop-list-panel">'
            + `<div id="${prefix}-item-grid" class="age-barracks-unit-grid age-gear-shop-item-grid" aria-live="polite"></div>`
            + '</section>'
            + `<aside id="${prefix}-item-detail" class="${detailClass}" aria-live="polite"></aside>`
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '<p id="age-gear-shop-status" class="age-defense-workspace-status" aria-live="polite" hidden></p>'
            + '</div>'
        );
    }

    function resolveForgeDepartment(departmentId) {
        return FORGE_DEPARTMENTS.find((entry) => entry.id === departmentId) || FORGE_DEPARTMENTS[0];
    }

    function resolveForgeSubcategoryMeta(subcategoryId) {
        return FORGE_SUBCATEGORIES[String(subcategoryId || '').trim()] || FORGE_SUBCATEGORIES.weapons;
    }

    function resolveForgeDepartmentForSubcategory(subcategoryId) {
        const id = String(subcategoryId || '').trim();
        return FORGE_DEPARTMENTS.find((department) => department.subcategories.includes(id)) || FORGE_DEPARTMENTS[0];
    }

    function resolveForgeItemImage(item, isTool) {
        if (!item) return FORGE_SUBCATEGORIES.weapons.imageSrc;
        if (item.imageSrc) return item.imageSrc;
        if (isTool) return FORGE_SUBCATEGORIES.tools.imageSrc;
        const categoryId = String(item.forgeCategory || '').trim();
        return FORGE_SUBCATEGORIES[categoryId]?.imageSrc || FORGE_SUBCATEGORIES.weapons.imageSrc;
    }

    function resolveForgeSubcategoryItems(subcategoryId) {
        const meta = resolveForgeSubcategoryMeta(subcategoryId);
        if (meta.isTools) return FORGE_TOOLS;
        return resolveForgeCatalog().filter((item) => item.forgeCategory === meta.id);
    }

    function countForgeSubcategoryItems(subcategoryId) {
        return resolveForgeSubcategoryItems(subcategoryId).length;
    }

    function resolveForgeCatalog() {
        return GEAR_CATALOG.filter((item) => item.classId === 'commander');
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

    function renderForgeDepartmentNav() {
        const nav = global.document.getElementById('age-gear-shop-category-nav');
        if (!nav) return;

        nav.innerHTML = (
            '<p class="age-army-workspace-panel-title age-barracks-category-nav-title">Departments</p>'
            + FORGE_DEPARTMENTS.map((department) => {
                const isDeptActive = department.id === activeForgeDepartment;
                const subButtons = department.subcategories.map((subcategoryId) => {
                    const sub = resolveForgeSubcategoryMeta(subcategoryId);
                    const count = countForgeSubcategoryItems(subcategoryId);
                    const isSubActive = isDeptActive && subcategoryId === activeForgeSubcategory;
                    const countLabel = count ? ` (${count})` : '';
                    return (
                        `<button type="button"`
                        + ` class="age-gear-shop-subcategory-btn${isSubActive ? ' is-active' : ''}${count ? '' : ' is-empty'}"`
                        + ` data-forge-subcategory="${escapeHtml(subcategoryId)}"`
                        + ` aria-pressed="${isSubActive ? 'true' : 'false'}">`
                        + `<span class="age-gear-shop-subcategory-label">${escapeHtml(sub.label)}${escapeHtml(countLabel)}</span>`
                        + '</button>'
                    );
                }).join('');

                return (
                    `<div class="age-gear-shop-dept-group${isDeptActive ? ' is-active' : ''}">`
                    + `<button type="button"`
                    + ` class="age-barracks-category-btn age-gear-shop-dept-btn${isDeptActive ? ' is-active' : ''}"`
                    + ` data-forge-department="${escapeHtml(department.id)}"`
                    + ` aria-expanded="${isDeptActive ? 'true' : 'false'}">`
                    + `<span class="age-barracks-category-label">${escapeHtml(department.label)}</span>`
                    + '</button>'
                    + `<div class="age-gear-shop-subcategory-list"${isDeptActive ? '' : ' hidden'}>`
                    + subButtons
                    + '</div>'
                    + '</div>'
                );
            }).join('')
        );
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

    function formatInspectStatParts(key, value) {
        const qty = Math.max(0, Number(value) || 0);
        if (!qty) return null;
        const label = STAT_LABELS[key] || key;
        if (key === 'injuryMitigation' || key === 'guildXp') {
            const pct = Math.round(qty * 1000) / 10;
            return {
                label,
                value: `+${pct}%`,
                note: key === 'guildXp' ? 'City assault & border PvP' : 'City assault & border PvP; not training'
            };
        }
        const rounded = Math.round(qty * 10) / 10;
        if (key === 'command') {
            return { label, value: `+${rounded}`, note: 'PvP attack starting morale' };
        }
        if (key === 'morale') {
            return { label, value: `+${rounded}`, note: 'Shock & rout resistance (coming soon)' };
        }
        return { label, value: `+${rounded}`, note: '' };
    }

    function renderForgeStatTable(stats) {
        if (!stats || typeof stats !== 'object') return '';
        const rows = Object.entries(stats)
            .map(([key, value]) => formatInspectStatParts(key, value))
            .filter(Boolean)
            .map((row) => (
                '<div class="age-gear-shop-inspect-stat-row">'
                + `<dt class="age-gear-shop-inspect-stat-label">${escapeHtml(row.label)}</dt>`
                + '<dd class="age-gear-shop-inspect-stat-value">'
                + `<span class="age-gear-shop-inspect-stat-qty">${escapeHtml(row.value)}</span>`
                + (row.note ? `<span class="age-gear-shop-inspect-stat-note">${escapeHtml(row.note)}</span>` : '')
                + '</dd>'
                + '</div>'
            ))
            .join('');
        if (!rows) return '';
        return (
            '<section class="age-gear-shop-inspect-section" aria-labelledby="age-gear-shop-inspect-stats-title">'
            + '<h4 id="age-gear-shop-inspect-stats-title" class="age-gear-shop-inspect-section-title">Attributes</h4>'
            + `<dl class="age-gear-shop-inspect-stat-grid">${rows}</dl>`
            + '</section>'
        );
    }

    function formatRarityLabel(rarity) {
        const id = String(rarity || 'common').trim().toLowerCase();
        return id.charAt(0).toUpperCase() + id.slice(1);
    }

    function resolveForgeInspectStatus(item, state, rank, isTool) {
        const owned = isTool ? resolveOwnedToolSet(state).has(item.id) : resolveOwnedGearSet(state).has(item.id);
        const equipped = !isTool && isEquipped(state, item.id);
        const rankLocked = rank < item.equipMinRank;
        if (equipped) {
            return { id: 'equipped', label: 'Equipped' };
        }
        if (owned && isTool) {
            return { id: 'owned', label: 'Owned' };
        }
        if (owned) {
            return rankLocked
                ? { id: 'owned-locked', label: 'Owned · Rank Locked' }
                : { id: 'owned', label: 'Owned' };
        }
        if (rankLocked) {
            return { id: 'rank-locked', label: 'Rank Locked' };
        }
        return { id: 'for-sale', label: 'For Sale' };
    }

    function renderForgeInspectTags(item, state, rank, isTool, handMeta, subcategory) {
        const tags = [];
        const status = resolveForgeInspectStatus(item, state, rank, isTool);
        tags.push(`<span class="age-gear-shop-inspect-tag is-status-${escapeHtml(status.id)}">${escapeHtml(status.label)}</span>`);
        if (!isTool && item.rarity) {
            tags.push(`<span class="age-gear-shop-inspect-tag is-rarity-${escapeHtml(item.rarity)}">${escapeHtml(formatRarityLabel(item.rarity))}</span>`);
        }
        if (!isTool && item.tier) {
            tags.push(`<span class="age-gear-shop-inspect-tag is-tier">Tier ${escapeHtml(item.tier)}</span>`);
        }
        if (handMeta) {
            tags.push(`<span class="age-gear-shop-inspect-tag is-hand">${escapeHtml(handMeta)}</span>`);
        }
        tags.push(`<span class="age-gear-shop-inspect-tag is-category">${escapeHtml(subcategory.label)}</span>`);
        return `<div class="age-gear-shop-inspect-tags">${tags.join('')}</div>`;
    }

    function renderForgeInspectFooter(item, state, rank, isTool) {
        const owned = isTool ? resolveOwnedToolSet(state).has(item.id) : resolveOwnedGearSet(state).has(item.id);
        const equipped = !isTool && isEquipped(state, item.id);
        const showPrice = !owned && !equipped;
        const priceBlock = showPrice
            ? (
                '<div class="age-gear-shop-inspect-price-block">'
                + '<span class="age-gear-shop-inspect-price-label">Purchase Cost</span>'
                + `<span class="age-gear-shop-inspect-price-value">${escapeHtml(formatGold(item.purchaseGold))} <span class="age-gear-shop-inspect-price-unit">gold</span></span>`
                + '</div>'
            )
            : (
                '<div class="age-gear-shop-inspect-price-block is-owned">'
                + `<span class="age-gear-shop-inspect-price-label">${equipped ? 'Currently Equipped' : 'In Your Inventory'}</span>`
                + '</div>'
            );
        return (
            '<footer class="age-gear-shop-inspect-footer">'
            + priceBlock
            + renderForgeActionPanel(item, state, rank, isTool)
            + '</footer>'
        );
    }

    function renderForgeItemCard(item, state, rank, isTool) {
        const isActive = selectedForgeItemId === item.id;
        const owned = isTool ? resolveOwnedToolSet(state).has(item.id) : resolveOwnedGearSet(state).has(item.id);
        const equipped = !isTool && isEquipped(state, item.id);
        const imageSrc = resolveForgeItemImage(item, isTool);
        const meta = formatItemCardMeta(item, state, rank, { isTool });
        const locked = !owned && rank < item.equipMinRank;
        const rarity = escapeHtml(item.rarity || 'common');
        return (
            `<button type="button"`
            + ` class="age-barracks-unit-card age-gear-shop-item-card${isActive ? ' is-active' : ''}${locked && !owned ? ' is-locked' : ''}${equipped ? ' is-equipped' : ''} is-rarity-${rarity}"`
            + ` data-gear-shop-item="${escapeHtml(item.id)}"`
            + ` aria-pressed="${isActive ? 'true' : 'false'}">`
            + `<span class="age-gear-shop-item-thumb" aria-hidden="true">`
            + `<img class="age-gear-shop-item-thumb-img" src="${escapeHtml(imageSrc)}" alt="" loading="lazy" decoding="async">`
            + '</span>'
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
            return '<div class="age-gear-shop-detail-actions age-gear-shop-inspect-actions"><span class="age-gear-shop-inspect-action-status is-equipped">Equipped</span></div>';
        }
        if (owned && !isTool) {
            if (!canEquip) {
                return `<div class="age-gear-shop-detail-actions age-gear-shop-inspect-actions"><span class="age-gear-shop-inspect-action-status is-locked">Equip at ${escapeHtml(resolveRankThresholdLabel(item.equipMinRank))}</span></div>`;
            }
            return (
                '<div class="age-gear-shop-detail-actions age-gear-shop-inspect-actions">'
                + `<button type="button" class="age-barracks-purchase-btn is-ready age-gear-shop-inspect-action-btn" data-forge-equip="${escapeHtml(item.id)}">Equip Gear</button>`
                + '</div>'
            );
        }
        if (owned && isTool) {
            return '<div class="age-gear-shop-detail-actions age-gear-shop-inspect-actions"><span class="age-gear-shop-inspect-action-status is-owned">Owned — stowed in inventory</span></div>';
        }
        const purchaseAttr = isTool ? 'data-forge-tool-purchase' : 'data-forge-purchase';
        const disabled = canAfford ? '' : ' disabled';
        return (
            '<div class="age-gear-shop-detail-actions age-gear-shop-inspect-actions">'
            + `<button type="button" class="age-barracks-purchase-btn${canAfford ? ' is-ready' : ''} age-gear-shop-inspect-action-btn" ${purchaseAttr}="${escapeHtml(item.id)}"${disabled}>`
            + `Purchase`
            + '</button>'
            + '</div>'
        );
    }

    function renderForgeInspectEmpty() {
        const panel = global.document.getElementById('age-gear-shop-item-detail');
        if (!panel) return;
        panel.classList.remove('is-open');
        panel.innerHTML = (
            '<div class="age-gear-shop-inspect-empty">'
            + '<div class="age-gear-shop-inspect-empty-frame" aria-hidden="true">'
            + '<span class="age-gear-shop-inspect-empty-glyph">⧉</span>'
            + '</div>'
            + '<p class="age-gear-shop-inspect-empty-eyebrow">Equipment Inspector</p>'
            + '<p class="age-gear-shop-inspect-empty-title">No Item Selected</p>'
            + '<p class="age-gear-shop-inspect-empty-copy">Choose gear from the catalog to review artwork, attributes, requirements, and purchase options.</p>'
            + '</div>'
        );
    }

    function renderForgeItemDetail(item, state, rank, isTool) {
        const panel = global.document.getElementById('age-gear-shop-item-detail');
        if (!panel) return;
        if (!item) {
            renderForgeInspectEmpty();
            return;
        }

        panel.classList.add('is-open');
        const rarity = String(item.rarity || 'common').trim().toLowerCase();
        const imageSrc = resolveForgeItemImage(item, isTool);
        const subcategory = resolveForgeSubcategoryMeta(item.forgeCategory || (isTool ? 'tools' : 'weapons'));
        const progress = !isTool && BATTLE_XP_SLOTS.has(item.slot)
            ? resolveGearProgress(state, item.id)
            : null;
        const handMeta = !isTool && typeof GearEquipRules.formatHandSlotMeta === 'function'
            ? GearEquipRules.formatHandSlotMeta(item)
            : '';
        const battleEffect = String(item.battleEffect || '').trim();
        const slotLabel = !isTool && item.slot
            ? (GEAR_SLOT_LABELS[item.slot] || item.slot)
            : subcategory.label;
        const statTable = renderForgeStatTable(item.stats);
        const battleSection = battleEffect
            ? (
                '<section class="age-gear-shop-inspect-section" aria-labelledby="age-gear-shop-inspect-combat-title">'
                + '<h4 id="age-gear-shop-inspect-combat-title" class="age-gear-shop-inspect-section-title">Combat Effect</h4>'
                + '<div class="age-gear-shop-inspect-callout is-combat">'
                + `<p class="age-gear-shop-inspect-callout-title">${escapeHtml(battleEffect.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))}</p>`
                + '<p class="age-gear-shop-inspect-callout-copy">Active in city assault and border PvP when equipped in main hand.</p>'
                + '</div>'
                + '</section>'
            )
            : '';
        const masterySection = progress
            ? (
                '<section class="age-gear-shop-inspect-section" aria-labelledby="age-gear-shop-inspect-mastery-title">'
                + '<h4 id="age-gear-shop-inspect-mastery-title" class="age-gear-shop-inspect-section-title">Mastery</h4>'
                + '<dl class="age-gear-shop-inspect-meta-grid">'
                + '<div class="age-gear-shop-inspect-meta-row">'
                + '<dt>Level</dt>'
                + `<dd>${escapeHtml(formatGearLevelLabel(progress.level))}</dd>`
                + '</div>'
                + (progress.level < MAX_GEAR_LEVEL
                    ? (
                        '<div class="age-gear-shop-inspect-meta-row">'
                        + '<dt>Progress</dt>'
                        + `<dd>${escapeHtml(formatGearXpProgress(state, item.id))}</dd>`
                        + '</div>'
                    )
                    : (
                        '<div class="age-gear-shop-inspect-meta-row">'
                        + '<dt>Progress</dt>'
                        + '<dd>Maximum mastery reached</dd>'
                        + '</div>'
                    ))
                + '</dl>'
                + '</section>'
            )
            : '';
        const requirementsSection = (
            '<section class="age-gear-shop-inspect-section" aria-labelledby="age-gear-shop-inspect-req-title">'
            + '<h4 id="age-gear-shop-inspect-req-title" class="age-gear-shop-inspect-section-title">Requirements</h4>'
            + '<dl class="age-gear-shop-inspect-meta-grid">'
            + '<div class="age-gear-shop-inspect-meta-row">'
            + '<dt>Equip Rank</dt>'
            + `<dd>${escapeHtml(resolveRankThresholdLabel(item.equipMinRank))}</dd>`
            + '</div>'
            + (!isTool && item.slot
                ? (
                    '<div class="age-gear-shop-inspect-meta-row">'
                    + '<dt>Equipment Slot</dt>'
                    + `<dd>${escapeHtml(slotLabel)}</dd>`
                    + '</div>'
                )
                : '')
            + '</dl>'
            + '</section>'
        );

        panel.innerHTML = (
            `<div class="age-gear-shop-inspect-inner is-rarity-${escapeHtml(rarity)}">`
            + '<div class="age-gear-shop-inspect-scroll">'
            + `<div class="age-gear-shop-inspect-art is-rarity-${escapeHtml(rarity)}">`
            + `<img class="age-gear-shop-inspect-art-img" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">`
            + '</div>'
            + '<header class="age-gear-shop-inspect-identity">'
            + `<p class="age-gear-shop-inspect-eyebrow">${escapeHtml(subcategory.label)}${!isTool && item.slot ? ` · ${escapeHtml(slotLabel)}` : ''}</p>`
            + `<h3 class="age-gear-shop-inspect-title">${escapeHtml(item.name)}</h3>`
            + renderForgeInspectTags(item, state, rank, isTool, handMeta, subcategory)
            + '</header>'
            + '<section class="age-gear-shop-inspect-section" aria-labelledby="age-gear-shop-inspect-overview-title">'
            + '<h4 id="age-gear-shop-inspect-overview-title" class="age-gear-shop-inspect-section-title">Overview</h4>'
            + `<p class="age-gear-shop-inspect-desc">${escapeHtml(item.desc)}</p>`
            + '</section>'
            + statTable
            + battleSection
            + masterySection
            + requirementsSection
            + '</div>'
            + renderForgeInspectFooter(item, state, rank, isTool)
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

    function sumLocalGearStatTotals(slots) {
        const totals = {
            strength: 0,
            ranged: 0,
            morale: 0,
            command: 0,
            injuryMitigation: 0,
            guildXp: 0
        };
        (slots || []).forEach((slot) => {
            const stats = slot?.equipped?.stats;
            if (!stats || typeof stats !== 'object') return;
            Object.entries(stats).forEach(([key, value]) => {
                if (!Object.prototype.hasOwnProperty.call(totals, key)) return;
                totals[key] += Math.max(0, Number(value) || 0);
            });
        });
        return totals;
    }

    function buildLocalGearStatLines(statTotals, slots) {
        const lines = [];
        Object.entries(statTotals || {}).forEach(([key, value]) => {
            const formatted = formatGearStatToken(key, value);
            if (!formatted) return;
            lines.push({ label: STAT_LABELS[key] || key, formatted });
        });

        (slots || []).forEach((slot) => {
            const effect = String(slot?.equipped?.battleEffect || '').trim();
            if (!effect) return;
            const pretty = effect.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
            lines.push({ label: 'battleEffect', formatted: pretty });
        });

        return lines;
    }

    function applyLocalEquippedOverlay(gearPanel) {
        if (!gearPanel || typeof gearPanel !== 'object') return gearPanel;
        const state = readState();
        const slots = TRAINING_GEAR_SLOT_ORDER.map((slotDef) => {
            const itemId = mapLegacyGearId(state.equipped?.[slotDef.id]);
            const item = GEAR_BY_ID[itemId];
            return {
                id: slotDef.id,
                label: slotDef.label,
                column: slotDef.id,
                row: 0,
                equipped: item
                    ? {
                        itemId: item.id,
                        name: item.name,
                        rarity: item.rarity || 'common',
                        iconSrc: '',
                        battleEffect: item.battleEffect || '',
                        stats: { ...(item.stats || {}) }
                    }
                    : null
            };
        });
        const statTotals = sumLocalGearStatTotals(slots);
        return {
            ...gearPanel,
            slots,
            statTotals,
            statLines: buildLocalGearStatLines(statTotals, slots)
        };
    }

    function resolveInventoryItemMeta(entry) {
        if (!entry) return null;
        if (entry.type === 'tool') {
            const tool = TOOL_BY_ID[entry.itemId];
            if (!tool) return null;
            return {
                type: 'tool',
                itemId: tool.id,
                name: tool.name,
                mark: tool.mark || '⚙',
                rarity: 'common'
            };
        }
        const gear = GEAR_BY_ID[entry.itemId];
        if (!gear) return null;
        const state = readState();
        const progress = resolveGearProgress(state, gear.id);
        return {
            type: 'gear',
            itemId: gear.id,
            name: gear.name,
            mark: SLOT_MARKS[gear.slot] || '•',
            rarity: gear.rarity || 'common',
            slot: gear.slot,
            level: progress.level
        };
    }

    function renderInventorySlotMarkup(slotIndex, entry, unlocked) {
        const index = Math.floor(Number(slotIndex));
        const isLocked = index >= unlocked;
        if (isLocked) {
            return (
                `<div class="age-guild-inventory-slot is-locked" data-inventory-slot="${index}" aria-label="Locked inventory slot">`
                + '<span class="age-guild-inventory-slot-lock" aria-hidden="true">🔒</span>'
                + '</div>'
            );
        }

        const meta = resolveInventoryItemMeta(entry);
        if (!meta) {
            return (
                `<div class="age-guild-inventory-slot is-empty" data-inventory-slot="${index}" aria-label="Empty inventory slot">`
                + '<span class="age-guild-inventory-slot-empty">—</span>'
                + '</div>'
            );
        }

        const levelLine = meta.type === 'gear' && meta.level
            ? ` · ${formatGearLevelLabel(meta.level)}`
            : '';
        const title = `${meta.name}${levelLine}`;
        const canEquip = meta.type === 'gear';
        const tagName = canEquip ? 'button' : 'div';
        const attrs = canEquip
            ? ` type="button" data-inventory-equip="${index}" title="${escapeHtml(title)}"`
            : ` title="${escapeHtml(title)}"`;
        const role = canEquip ? '' : ' role="presentation"';

        return (
            `<${tagName} class="age-guild-inventory-slot is-filled is-${escapeHtml(meta.type)} is-rarity-${escapeHtml(meta.rarity)}"`
            + ` data-inventory-slot="${index}"${attrs}${role}`
            + ` aria-label="${escapeHtml(meta.name)}">`
            + `<span class="age-guild-inventory-slot-mark" aria-hidden="true">${escapeHtml(meta.mark)}</span>`
            + `<span class="age-guild-inventory-slot-name">${escapeHtml(meta.name)}</span>`
            + `</${tagName}>`
        );
    }

    function renderInventoryPanel(prefix) {
        const gridEl = global.document.getElementById(`${prefix}-inventory-grid`);
        const capacityEl = global.document.getElementById(`${prefix}-inventory-capacity`);
        if (!gridEl) return;

        const state = readState();
        ensureInventoryState(state);
        const used = countInventoryItems(state);
        const unlocked = state.inventoryUnlocked;

        if (capacityEl) {
            capacityEl.textContent = `${used} / ${unlocked} slots · ${INVENTORY_MAX_SLOTS} total`;
        }

        gridEl.innerHTML = state.inventorySlots
            .map((entry, index) => renderInventorySlotMarkup(index, entry, unlocked))
            .join('');
    }

    function refreshTrainingInventoryPanel() {
        renderInventoryPanel(TRAINING_PANEL_PREFIX);
    }

    function refreshForgeShopUi() {
        const grid = global.document.getElementById('age-gear-shop-item-grid');
        if (!grid) return;

        const state = readState();
        const rank = resolveCommanderRank();
        const subcategoryMeta = resolveForgeSubcategoryMeta(activeForgeSubcategory);
        const isTools = Boolean(subcategoryMeta.isTools);
        const items = resolveForgeSubcategoryItems(activeForgeSubcategory);
        const department = resolveForgeDepartment(activeForgeDepartment);

        syncGearShopCommanderStatus('age-gear-shop');
        const labelEl = global.document.getElementById('age-gear-shop-active-category-label');
        if (labelEl) {
            labelEl.textContent = `${department.label} · ${subcategoryMeta.label}`;
        }
        renderForgeDepartmentNav();

        if (!items.length) {
            grid.innerHTML = `<p class="age-barracks-empty">No ${subcategoryMeta.label.toLowerCase()} listed yet. New stock arrives as campaigns expand.</p>`;
            if (selectedForgeItemId) {
                selectedForgeItemId = '';
            }
            renderForgeItemDetail(null);
            return;
        }

        if (selectedForgeItemId && !items.some((item) => item.id === selectedForgeItemId)) {
            selectedForgeItemId = '';
        }

        grid.innerHTML = items.map((item) => renderForgeItemCard(item, state, rank, isTools)).join('');
        const selected = items.find((item) => item.id === selectedForgeItemId) || null;
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

    function equipItemToSlot(state, item, sourceInventoryIndex, preferredSlot) {
        const targetSlot = String(preferredSlot || resolveEquipTargetSlot(item, state.equipped) || '').trim();
        if (!targetSlot) return { ok: false, reason: 'invalid_slot' };

        const slotCheck = GearEquipRules.canEquipGearItemToSlot
            ? GearEquipRules.canEquipGearItemToSlot(item, targetSlot, state.equipped, resolveGearItemById)
            : { ok: targetSlot === String(item?.slot || '').trim() };
        if (!slotCheck.ok) {
            return { ok: false, reason: slotCheck.reason || 'off_hand_not_eligible' };
        }

        const displaced = mapLegacyGearId(state.equipped?.[targetSlot]);
        if (displaced && displaced !== item.id) {
            if (!addToInventory(state, { type: 'gear', itemId: displaced })) {
                return { ok: false, reason: 'inventory_full' };
            }
        }

        state.equipped[targetSlot] = item.id;

        if (targetSlot === 'mainHand' && item.handedness === 'twoHand' && state.equipped.offHand) {
            const offId = mapLegacyGearId(state.equipped.offHand);
            if (offId && offId !== item.id) {
                if (!addToInventory(state, { type: 'gear', itemId: offId })) {
                    delete state.equipped[targetSlot];
                    if (displaced) state.equipped[targetSlot] = displaced;
                    return { ok: false, reason: 'inventory_full' };
                }
            }
            delete state.equipped.offHand;
        }

        state.equipped = sanitizeLocalEquippedMap(state.equipped);

        if (sourceInventoryIndex != null && sourceInventoryIndex !== '') {
            const index = Math.floor(Number(sourceInventoryIndex));
            if (Number.isFinite(index) && state.inventorySlots[index]?.itemId === item.id) {
                state.inventorySlots[index] = null;
            }
        } else {
            state.inventorySlots.forEach((entry, index) => {
                if (entry?.type === 'gear' && entry.itemId === item.id) {
                    state.inventorySlots[index] = null;
                }
            });
        }

        return { ok: true, slot: targetSlot };
    }

    function purchaseForgeItem(itemId) {
        const item = GEAR_BY_ID[String(itemId || '').trim()];
        if (!item) return false;
        const state = readState();
        if (resolveOwnedGearSet(state).has(item.id)) {
            setShopStatus(`${item.name} is already in your inventory.`, true);
            return false;
        }
        if (!canPlacePurchasedItem(state, item, false)) {
            setShopStatus('Inventory full — free a slot before purchasing.', true);
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
        const placement = placePurchasedItem(state, item, false);
        if (!placement.success) {
            setShopStatus('Inventory full — free a slot before purchasing.', true);
            return false;
        }
        writeState(state);
        setShopStatus(formatPurchasePlacementMessage(item, placement, false));
        refreshTrainingLoadoutAfterInventoryChange();
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
        if (!canPlacePurchasedItem(state, tool, true)) {
            setShopStatus('Inventory full — free a slot before purchasing.', true);
            return false;
        }
        if (resolveGold() < tool.purchaseGold || !spendGold(tool.purchaseGold, 'forge-tool')) {
            setShopStatus('Not enough gold for this tool.', true);
            return false;
        }
        const placement = placePurchasedItem(state, tool, true);
        if (!placement.success) {
            setShopStatus('Inventory full — free a slot before purchasing.', true);
            return false;
        }
        writeState(state);
        setShopStatus(formatPurchasePlacementMessage(tool, placement, true));
        refreshTrainingLoadoutAfterInventoryChange();
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
        const result = equipItemToSlot(state, item);
        if (!result.ok) {
            if (result.reason === 'inventory_full') {
                setShopStatus('Inventory full — make room before swapping gear.', true);
            } else {
                setShopStatus(describeEquipFailure(result.reason), true);
            }
            return false;
        }
        ensureGearProgress(state, item.id);
        writeState(state);
        setShopStatus(`${item.name} equipped to ${GEAR_SLOT_LABELS[result.slot] || result.slot}.`);
        return true;
    }

    function equipFromInventory(slotIndex) {
        const state = readState();
        const index = Math.floor(Number(slotIndex));
        const entry = state.inventorySlots[index];
        if (!entry || entry.type !== 'gear') return false;

        const item = GEAR_BY_ID[entry.itemId];
        if (!item) return false;

        const rank = resolveCommanderRank();
        if (rank < item.equipMinRank) {
            setShopStatus(`Equip ${item.name} at ${resolveRankThresholdLabel(item.equipMinRank)}.`, true);
            return false;
        }

        const result = equipItemToSlot(state, item, index);
        if (!result.ok) {
            if (result.reason === 'inventory_full') {
                setShopStatus('Inventory full — make room before swapping gear.', true);
            } else {
                setShopStatus(describeEquipFailure(result.reason), true);
            }
            return false;
        }

        ensureGearProgress(state, item.id);
        writeState(state);
        setShopStatus(`${item.name} equipped to ${GEAR_SLOT_LABELS[result.slot] || result.slot}.`);
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
        state.inventorySlots.forEach((entry, index) => {
            if (entry?.type === 'gear' && entry.itemId === next.id) {
                state.inventorySlots[index] = null;
            }
        });
        if (currentId && currentId !== next.id) {
            addToInventory(state, { type: 'gear', itemId: currentId });
        }
        state.equipped[slot] = next.id;
        state.equipped = sanitizeLocalEquippedMap(state.equipped);
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
            const departmentBtn = event.target.closest('[data-forge-department]');
            if (departmentBtn) {
                event.preventDefault();
                const departmentId = departmentBtn.getAttribute('data-forge-department') || 'arms';
                activeForgeDepartment = departmentId;
                const department = resolveForgeDepartment(departmentId);
                if (!department.subcategories.includes(activeForgeSubcategory)) {
                    activeForgeSubcategory = department.subcategories[0] || 'weapons';
                }
                selectedForgeItemId = '';
                refreshForgeShopUi();
                return true;
            }

            const subcategoryBtn = event.target.closest('[data-forge-subcategory]');
            if (subcategoryBtn) {
                event.preventDefault();
                activeForgeSubcategory = subcategoryBtn.getAttribute('data-forge-subcategory') || 'weapons';
                activeForgeDepartment = resolveForgeDepartmentForSubcategory(activeForgeSubcategory).id;
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

    function refreshTrainingLoadoutAfterInventoryChange() {
        refreshTrainingInventoryPanel();
        if (global.RoyalArmiesAdventurersGuild?.isTrainingOpen?.()) {
            global.RoyalArmiesAdventurersGuild.refreshTrainingLoadout?.();
        }
    }

    function bindHandlers() {
        if (handlersBound) return;
        handlersBound = true;
        global.document.addEventListener('click', (event) => {
            const inventoryEquipBtn = event.target.closest('[data-inventory-equip]');
            if (!inventoryEquipBtn) return;
            if (!inventoryEquipBtn.closest('#age-guild-training-arena')) return;
            event.preventDefault();
            if (equipFromInventory(inventoryEquipBtn.getAttribute('data-inventory-equip'))) {
                refreshTrainingLoadoutAfterInventoryChange();
            }
        });
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
            if (global.RoyalArmiesAdventurersGuild?.isTrainingOpen?.()) {
                refreshTrainingLoadoutAfterInventoryChange();
            }
        });
    }

    bindHandlers();

    global.RoyalArmiesAgeGearShop = Object.freeze({
        EQUIPMENT_MIN_RANK,
        ARMORY_UPGRADE_MIN_LEVEL,
        MAX_GEAR_LEVEL,
        INVENTORY_MAX_SLOTS,
        INVENTORY_START_UNLOCKED,
        renderForgeBody,
        renderArmoryBody,
        onGearShopClick,
        resolveEquipmentRankLockReason,
        resolveForgeEyebrow,
        resolveArmoryEyebrow,
        refreshActiveBody,
        refreshTrainingInventoryPanel,
        applyLocalEquippedOverlay,
        readState,
        writeState,
        grantBattleXpFromTraining,
        resolveGearProgress,
        formatGearLevelLabel
    });
})(window);

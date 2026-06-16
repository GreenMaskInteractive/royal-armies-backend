/**
 * NEXUS — Age commander gear (MMORPG equipment slots + stat bonuses).
 */
'use strict';

const {
    resolveCommanderClassId,
    COMMANDER_CLASS_LABELS: CLASS_LABELS,
    COMMANDER_CLASS_PORTRAITS: CLASS_PORTRAITS
} = require('./nexus-commander-class');
const { sanitizeEquippedSlotMap } = require('./nexus-age-gear-equip-rules');

function resolveCommanderRank(commander) {
    return Math.max(1, Math.floor(Number(commander?.rank) || 1));
}

const GEAR_SLOT_ORDER = Object.freeze([
    { id: 'head', label: 'Head', column: 'center', row: 0 },
    { id: 'mainHand', label: 'Main Hand', column: 'left', row: 1 },
    { id: 'offHand', label: 'Off Hand', column: 'right', row: 1 },
    { id: 'chest', label: 'Chest', column: 'center', row: 2 },
    { id: 'hands', label: 'Hands', column: 'left', row: 2 },
    { id: 'legs', label: 'Legs', column: 'center', row: 3 },
    { id: 'feet', label: 'Feet', column: 'center', row: 4 },
    { id: 'cloak', label: 'Cloak', column: 'left', row: 3 },
    { id: 'ring', label: 'Ring', column: 'right', row: 2 },
    { id: 'amulet', label: 'Amulet', column: 'right', row: 3 }
]);

const STAT_LABELS = Object.freeze({
    strength: 'Strength',
    ranged: 'Ranged',
    morale: 'Morale',
    command: 'Command',
    injuryMitigation: 'Injury Mitigation',
    guildXp: 'Guild XP'
});

/** Effective +Command from acquired gear (diminishing cap for PvP assault bonuses). */
const COMMAND_GEAR_EFFECTIVE_CAP = 12;
const COMMAND_PVP_STARTING_MORALE_BONUS_CAP = 8;
const PVP_COMMAND_MORALE_BATTLE_MODES = Object.freeze(['city-assault', 'border-pvp']);

const GEAR_ITEMS = Object.freeze({
    'bm-patrol-blade': {
        name: 'Patrol Blade',
        slot: 'mainHand',
        handedness: 'oneHand',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        iconSrc: 'images/battlemasterclass.png',
        stats: { strength: 3, morale: 1 }
    },
    'bm-training-shield': {
        name: 'Training Shield',
        slot: 'offHand',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { command: 1, injuryMitigation: 0.02 }
    },
    'bm-patrol-helm': {
        name: 'Patrol Helm',
        slot: 'head',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { strength: 1, injuryMitigation: 0.01 }
    },
    'bm-leather-cuirass': {
        name: 'Leather Cuirass',
        slot: 'chest',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { strength: 2, injuryMitigation: 0.03 }
    },
    'bm-grip-gloves': {
        name: 'Grip Gloves',
        slot: 'hands',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { strength: 1, command: 1 }
    },
    'bm-march-greaves': {
        name: 'March Greaves',
        slot: 'legs',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { morale: 1, injuryMitigation: 0.01 }
    },
    'bm-road-boots': {
        name: 'Road Boots',
        slot: 'feet',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { morale: 1 }
    },
    'bm-guild-cloak': {
        name: 'Guild Cloak',
        slot: 'cloak',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { guildXp: 0.02, command: 1 }
    },
    'bm-signet-ring': {
        name: 'Signet Ring',
        slot: 'ring',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { command: 2 }
    },
    'bm-command-amulet': {
        name: 'Command Amulet',
        slot: 'amulet',
        classId: 'battlemaster',
        tier: 1,
        rarity: 'common',
        stats: { morale: 2, guildXp: 0.01 }
    },
    'am-focus-staff': {
        name: 'Focus Staff',
        slot: 'mainHand',
        handedness: 'twoHand',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        iconSrc: 'images/classarchmage.png',
        stats: { ranged: 4, morale: 1 }
    },
    'am-arcane-tome': {
        name: 'Arcane Tome',
        slot: 'offHand',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 2, command: 1 }
    },
    'am-circlet': {
        name: 'Circlet of Study',
        slot: 'head',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, guildXp: 0.02 }
    },
    'am-robes': {
        name: 'Scholar Robes',
        slot: 'chest',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 2, injuryMitigation: 0.02 }
    },
    'am-weave-gloves': {
        name: 'Weave Gloves',
        slot: 'hands',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, command: 1 }
    },
    'am-runed-leggings': {
        name: 'Runed Leggings',
        slot: 'legs',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 2 }
    },
    'am-soft-shoes': {
        name: 'Soft Shoes',
        slot: 'feet',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 1, injuryMitigation: 0.01 }
    },
    'am-mystic-cloak': {
        name: 'Mystic Cloak',
        slot: 'cloak',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, guildXp: 0.02 }
    },
    'am-band-ring': {
        name: 'Band Ring',
        slot: 'ring',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { command: 2 }
    },
    'am-sigil-amulet': {
        name: 'Sigil Amulet',
        slot: 'amulet',
        classId: 'battlemage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 2, injuryMitigation: 0.01 }
    },
    'bm-veteran-blade': {
        name: 'Veteran Blade',
        slot: 'mainHand',
        handedness: 'oneHand',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        iconSrc: 'images/battlemasterclass.png',
        stats: { strength: 5, morale: 2 }
    },
    'bm-veteran-shield': {
        name: 'Veteran Shield',
        slot: 'offHand',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { command: 2, injuryMitigation: 0.04 }
    },
    'bm-veteran-helm': {
        name: 'Veteran Helm',
        slot: 'head',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { strength: 2, injuryMitigation: 0.02 }
    },
    'bm-veteran-cuirass': {
        name: 'Veteran Cuirass',
        slot: 'chest',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { strength: 3, injuryMitigation: 0.05 }
    },
    'bm-veteran-gloves': {
        name: 'Veteran Gauntlets',
        slot: 'hands',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { strength: 2, command: 2 }
    },
    'bm-veteran-greaves': {
        name: 'Veteran Greaves',
        slot: 'legs',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 2, injuryMitigation: 0.02 }
    },
    'bm-veteran-boots': {
        name: 'Veteran Boots',
        slot: 'feet',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 2 }
    },
    'bm-veteran-cloak': {
        name: 'Veteran Cloak',
        slot: 'cloak',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { guildXp: 0.04, command: 2 }
    },
    'bm-veteran-ring': {
        name: 'Veteran Ring',
        slot: 'ring',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { command: 3 }
    },
    'bm-veteran-amulet': {
        name: 'Veteran Amulet',
        slot: 'amulet',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 3, guildXp: 0.02 }
    },
    'am-veteran-staff': {
        name: 'Veteran Staff',
        slot: 'mainHand',
        handedness: 'twoHand',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        iconSrc: 'images/classarchmage.png',
        stats: { ranged: 6, morale: 2 }
    },
    'am-veteran-tome': {
        name: 'Veteran Tome',
        slot: 'offHand',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 3, command: 2 }
    },
    'am-veteran-circlet': {
        name: 'Veteran Circlet',
        slot: 'head',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, guildXp: 0.03 }
    },
    'am-veteran-robes': {
        name: 'Veteran Robes',
        slot: 'chest',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 3, injuryMitigation: 0.04 }
    },
    'am-veteran-gloves': {
        name: 'Veteran Gloves',
        slot: 'hands',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, command: 2 }
    },
    'am-veteran-leggings': {
        name: 'Veteran Leggings',
        slot: 'legs',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 3 }
    },
    'am-veteran-shoes': {
        name: 'Veteran Shoes',
        slot: 'feet',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 2, injuryMitigation: 0.02 }
    },
    'am-veteran-cloak': {
        name: 'Veteran Cloak',
        slot: 'cloak',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, guildXp: 0.04 }
    },
    'am-veteran-ring': {
        name: 'Veteran Ring',
        slot: 'ring',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { command: 3 }
    },
    'am-veteran-amulet': {
        name: 'Veteran Amulet',
        slot: 'amulet',
        classId: 'battlemage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 3, injuryMitigation: 0.02 }
    },
    'gear-commanders-signal-horn': {
        name: "Commander's Signal Horn",
        slot: 'mainHand',
        handedness: 'twoHand',
        classId: 'battlemaster',
        tier: 2,
        rarity: 'rare',
        battleEffect: 'signal-horn',
        stats: { command: 2, morale: 1 }
    },
    'gear-mage-slayer-harpoon': {
        name: 'Mage-Slayer Harpoon',
        slot: 'mainHand',
        handedness: 'twoHand',
        classId: 'battlemaster',
        tier: 3,
        rarity: 'rare',
        battleEffect: 'mage-slayer-harpoon',
        stats: { strength: 4 }
    },
    'gear-linked-resilient-plating': {
        name: 'Linked Resilient Plating',
        slot: 'chest',
        classId: 'battlemaster',
        tier: 3,
        rarity: 'rare',
        battleEffect: 'linked-resilient-plating',
        stats: { injuryMitigation: 0.05, strength: 2 }
    },
    'gear-null-stone-aegis': {
        name: 'Null-Stone Aegis',
        slot: 'offHand',
        classId: 'battlemaster',
        tier: 3,
        rarity: 'epic',
        battleEffect: 'null-stone-aegis',
        stats: { injuryMitigation: 0.04, morale: 2 }
    },
    'cmd-ironheart-saber': { name: 'Ironheart Saber', slot: 'mainHand', handedness: 'oneHand', dualWieldOffHand: true, classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, morale: 1 } },
    'cmd-warded-bulwark': { name: 'Warded Bulwark', slot: 'offHand', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, ranged: 1, injuryMitigation: 0.02 } },
    'cmd-oathbound-visor': { name: 'Oathbound Visor', slot: 'head', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, injuryMitigation: 0.01 } },
    'cmd-concord-mail': { name: 'Concord Mail', slot: 'chest', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 2, ranged: 2, injuryMitigation: 0.03 } },
    'cmd-duelweave-gauntlets': { name: 'Duelweave Gauntlets', slot: 'hands', classId: 'commander', tier: 1, rarity: 'common', stats: { strength: 1, ranged: 1, command: 1 } },
    'cmd-marchward-greaves': { name: 'Marchward Greaves', slot: 'legs', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, command: 1, injuryMitigation: 0.01 } },
    'cmd-pathfinder-treads': { name: 'Pathfinder Treads', slot: 'feet', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 1, injuryMitigation: 0.01, command: 1 } },
    'cmd-bannercloak-accord': { name: 'Bannercloak of Accord', slot: 'cloak', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 1, guildXp: 0.02, morale: 1 } },
    'cmd-covenant-signet': { name: 'Covenant Signet', slot: 'ring', classId: 'commander', tier: 1, rarity: 'common', stats: { command: 2 } },
    'cmd-twinpath-talisman': { name: 'Twinpath Talisman', slot: 'amulet', classId: 'commander', tier: 1, rarity: 'common', stats: { morale: 2, injuryMitigation: 0.01 } },
    'cmd-sovereign-edge': { name: "Sovereign's Edge", slot: 'mainHand', handedness: 'oneHand', dualWieldOffHand: true, classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 4, ranged: 4, morale: 2 } },
    'cmd-bastion-two-paths': { name: 'Bastion of Two Paths', slot: 'offHand', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, ranged: 1, injuryMitigation: 0.04 } },
    'cmd-crownward-casque': { name: 'Crownward Casque', slot: 'head', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, injuryMitigation: 0.02 } },
    'cmd-aegis-of-concord': { name: 'Aegis of Concord', slot: 'chest', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 3, ranged: 3, injuryMitigation: 0.05 } },
    'cmd-warfinger-gauntlets': { name: 'Warfinger Gauntlets', slot: 'hands', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { strength: 2, ranged: 2, command: 2 } },
    'cmd-legionward-plates': { name: 'Legionward Plates', slot: 'legs', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, command: 2, injuryMitigation: 0.02 } },
    'cmd-ironpath-sabatons': { name: 'Ironpath Sabatons', slot: 'feet', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 2, injuryMitigation: 0.02 } },
    'cmd-marshal-pathcloak': { name: "Marshal's Pathcloak", slot: 'cloak', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 2, guildXp: 0.04, morale: 2 } },
    'cmd-oathkeeper-band': { name: "Oathkeeper's Band", slot: 'ring', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { command: 3 } },
    'cmd-dualheart-amulet': { name: 'Dualheart Amulet', slot: 'amulet', classId: 'commander', tier: 2, rarity: 'uncommon', stats: { morale: 3, injuryMitigation: 0.02, guildXp: 0.01 } },
    'gear-horn-rallying-dawn': { name: 'Horn of Rallying Dawn', slot: 'mainHand', handedness: 'twoHand', classId: 'commander', tier: 2, rarity: 'rare', battleEffect: 'signal-horn', stats: { command: 2, morale: 1, strength: 1, ranged: 1 } },
    'gear-nullspike-harpoon': { name: 'Nullspike Harpoon', slot: 'mainHand', handedness: 'twoHand', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'mage-slayer-harpoon', stats: { strength: 3, ranged: 2 } },
    'gear-phoenix-interlock': { name: 'Phoenix Interlock Plate', slot: 'chest', classId: 'commander', tier: 3, rarity: 'rare', battleEffect: 'linked-resilient-plating', stats: { injuryMitigation: 0.05, strength: 2, ranged: 2 } },
    'gear-nullstone-palladium': { name: 'Nullstone Palladium', slot: 'offHand', classId: 'commander', tier: 3, rarity: 'epic', battleEffect: 'null-stone-aegis', stats: { injuryMitigation: 0.04, morale: 2, command: 1 } }
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
    'gear-null-stone-aegis': 'gear-nullstone-palladium'
});

const COMMANDER_DEFAULT_LOADOUT_TIER_1 = Object.freeze({
    head: 'cmd-oathbound-visor',
    chest: 'cmd-concord-mail',
    hands: 'cmd-duelweave-gauntlets',
    legs: 'cmd-marchward-greaves',
    feet: 'cmd-pathfinder-treads',
    mainHand: 'cmd-ironheart-saber',
    offHand: 'cmd-warded-bulwark',
    cloak: 'cmd-bannercloak-accord',
    ring: 'cmd-covenant-signet',
    amulet: 'cmd-twinpath-talisman'
});

const COMMANDER_DEFAULT_LOADOUT_TIER_2 = Object.freeze({
    head: 'cmd-crownward-casque',
    chest: 'cmd-aegis-of-concord',
    hands: 'cmd-warfinger-gauntlets',
    legs: 'cmd-legionward-plates',
    feet: 'cmd-ironpath-sabatons',
    mainHand: 'cmd-sovereign-edge',
    offHand: 'cmd-bastion-two-paths',
    cloak: 'cmd-marshal-pathcloak',
    ring: 'cmd-oathkeeper-band',
    amulet: 'cmd-dualheart-amulet'
});

const DEFAULT_LOADOUTS = Object.freeze({
    battlemaster: {
        1: COMMANDER_DEFAULT_LOADOUT_TIER_1,
        2: COMMANDER_DEFAULT_LOADOUT_TIER_2
    },
    battlemage: {
        1: COMMANDER_DEFAULT_LOADOUT_TIER_1,
        2: COMMANDER_DEFAULT_LOADOUT_TIER_2
    }
});

function resolveGearTierFromRank(rank) {
    if (rank >= 14) return 2;
    if (rank >= 7) return 2;
    return 1;
}

function resolveDefaultAvatarUrl(commander, classId) {
    const avatar = String(commander?.avatarUrl || '').trim();
    if (avatar) return avatar.slice(0, 512);
    return CLASS_PORTRAITS[classId] || CLASS_PORTRAITS.battlemaster;
}

function normalizeEquippedSlotMap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mapped = {};
    GEAR_SLOT_ORDER.forEach((slot) => {
        const itemId = mapLegacyGearId(raw[slot.id]);
        if (itemId) mapped[slot.id] = itemId;
    });
    const sanitized = sanitizeEquippedSlotMap(mapped, (itemId) => GEAR_ITEMS[itemId]);
    return Object.keys(sanitized).length ? sanitized : null;
}

function resolveEquippedSlotMap(commander) {
    const persisted = normalizeEquippedSlotMap(commander?.ageGearSlots);
    if (persisted) return persisted;
    // No acquired gear — empty loadout. Do not apply DEFAULT_LOADOUTS to battle outcomes.
    return {};
}

function commanderHasAcquiredGear(commander) {
    return Boolean(normalizeEquippedSlotMap(commander?.ageGearSlots));
}

/**
 * Legacy acquired guild-XP multiplier (trainer perk, gear, guild bonuses).
 * Not used by guild training drills — see calculateGuildTrainingBattleXp.
 */
function resolveAcquiredGuildTrainingXpMultiplier(commander, battleWinner) {
    if (String(battleWinner || '').trim().toLowerCase() !== 'commander') {
        return { multiplier: 1, sources: [] };
    }

    let multiplier = 1;
    const sources = [];

    if (commanderHasAcquiredGear(commander)) {
        const totals = buildCommanderEquipmentBonuses(commander);
        const gearXp = Math.max(0, Number(totals.guildXp) || 0);
        if (gearXp > 0) {
            multiplier += gearXp;
            sources.push({ type: 'gear', guildXp: gearXp });
        }
    }

    const perks = commander?.ageGuildPerks;
    if (perks && typeof perks === 'object') {
        const trainer = Math.max(0, Math.floor(Number(perks.trainer) || 0));
        if (trainer > 0) {
            const trainerBonus = trainer * 0.005;
            multiplier += trainerBonus;
            sources.push({ type: 'trainer', points: trainer, guildXp: trainerBonus });
        }
    }

    const guildBonuses = commander?.ageGuildBonuses;
    if (guildBonuses && typeof guildBonuses === 'object') {
        const bonusXp = Math.max(0, Number(guildBonuses.guildXp) || 0);
        if (bonusXp > 0) {
            multiplier += bonusXp;
            sources.push({ type: 'guild-bonus', guildXp: bonusXp });
        }
    }

    return {
        multiplier: Math.round(multiplier * 1000) / 1000,
        sources
    };
}

function resolvePreviewGearLoadout(commander) {
    const classId = resolveCommanderClassId(commander);
    const tier = resolveGearTierFromRank(resolveCommanderRank(commander));
    return DEFAULT_LOADOUTS[classId]?.[tier] || DEFAULT_LOADOUTS.battlemaster[1];
}

function mapLegacyGearId(itemId) {
    const id = String(itemId || '').trim();
    return LEGACY_GEAR_ID_MAP[id] || id;
}

function resolveGearItem(itemId) {
    const id = mapLegacyGearId(itemId);
    if (!id) return null;
    const item = GEAR_ITEMS[id];
    if (!item) return null;
    return { itemId: id, ...item };
}

function sumGearStatTotals(slots) {
    const totals = {
        strength: 0,
        ranged: 0,
        morale: 0,
        command: 0,
        injuryMitigation: 0,
        guildXp: 0
    };

    (Array.isArray(slots) ? slots : []).forEach((slot) => {
        const stats = slot?.equipped?.stats;
        if (!stats || typeof stats !== 'object') return;
        Object.keys(totals).forEach((key) => {
            totals[key] += Math.max(0, Number(stats[key]) || 0);
        });
    });

    return totals;
}

function formatStatLine(key, value) {
    if (!value) return null;
    const label = STAT_LABELS[key] || key;

    if (key === 'injuryMitigation' || key === 'guildXp') {
        const pct = Math.round(value * 1000) / 10;
        const scope = key === 'guildXp'
            ? ' (city assault & border PvP)'
            : ' (city assault & border PvP; not training)';
        return { key, label, value, formatted: `+${pct}% ${label}${scope}` };
    }

    const rounded = Math.round(value * 10) / 10;

    if (key === 'command') {
        return {
            key,
            label,
            value: rounded,
            formatted: `+${rounded} ${label} (city assault & border PvP attack starting morale)`
        };
    }

    if (key === 'morale') {
        return {
            key,
            label,
            value: rounded,
            formatted: `+${rounded} ${label} (morale shock & rout resistance — coming soon)`
        };
    }

    return { key, label, value: rounded, formatted: `+${rounded} ${label}` };
}

function resolveEffectiveCommandFromGear(commander) {
    if (!commanderHasAcquiredGear(commander)) return 0;
    const totals = buildCommanderEquipmentBonuses(commander);
    const raw = Math.max(0, Math.floor(Number(totals.command) || 0));
    return Math.min(COMMAND_GEAR_EFFECTIVE_CAP, raw);
}

function resolveCommandPvpAttackerStartingMoraleBonus(commander) {
    const command = resolveEffectiveCommandFromGear(commander);
    if (!command) return 0;
    return Math.min(COMMAND_PVP_STARTING_MORALE_BONUS_CAP, Math.floor(command / 2));
}

function resolveCommandPvpAttackerStartingMorale(commander, baseMorale = 100) {
    const base = Math.max(0, Math.floor(Number(baseMorale) || 0));
    return base + resolveCommandPvpAttackerStartingMoraleBonus(commander);
}

function isPvpCommandMoraleBattleMode(trainingMode) {
    const mode = String(trainingMode || '').trim().toLowerCase();
    return PVP_COMMAND_MORALE_BATTLE_MODES.includes(mode);
}

const BATTLE_EFFECT_COPY = Object.freeze({
    'signal-horn': 'City assault & border PvP: ranged damage marks surviving enemy stacks for +20% damage that phase.',
    'mage-slayer-harpoon': 'City assault & border PvP: physical cavalry deals +40% vs magic lanes when dominant unit tiers match.',
    'linked-resilient-plating': 'City assault & border PvP: +5% infantry HP from combined cavalry and beast lane HP at fight start.',
    'null-stone-aegis': 'City assault & border PvP: physical infantry absorbs 35% of magic artillery counter damage.'
});

function buildGearBattleEffectLines(slots) {
    const seen = new Set();
    const lines = [];

    (Array.isArray(slots) ? slots : []).forEach((slot) => {
        const effect = String(slot?.equipped?.battleEffect || '').trim();
        if (!effect || seen.has(effect)) return;
        const copy = BATTLE_EFFECT_COPY[effect];
        if (!copy) return;
        seen.add(effect);
        lines.push({
            key: `battle-${effect}`,
            label: slot.equipped.name || 'Battle gear',
            value: effect,
            formatted: copy
        });
    });

    return lines;
}

function buildGearStatLines(totals, slots) {
    const order = ['strength', 'ranged', 'morale', 'command', 'injuryMitigation', 'guildXp'];
    const baseLines = order
        .map((key) => formatStatLine(key, totals[key]))
        .filter(Boolean);
    return baseLines.concat(buildGearBattleEffectLines(slots));
}

function buildCommanderEquipmentBonuses(commander) {
    const panel = buildCommanderGearPanelPayload(commander);
    return {
        ...panel.statTotals,
        injuryMitigation: panel.statTotals.injuryMitigation || 0
    };
}

function buildCommanderGearPanelPayload(commander) {
    const classId = resolveCommanderClassId(commander);
    const classLabel = CLASS_LABELS[classId] || 'Battlemaster';
    const rank = resolveCommanderRank(commander);
    const path = String(commander?.path || 'PHYS').trim().slice(0, 16) || 'PHYS';
    const rankTitleGender = String(commander?.preferences?.rankTitleGender || 'male').trim().toLowerCase() === 'female'
        ? 'female'
        : 'male';
    const equippedMap = resolveEquippedSlotMap(commander);
    const username = String(commander?.username || 'Commander').trim() || 'Commander';

    const slots = GEAR_SLOT_ORDER.map((slotDef) => {
        const itemId = equippedMap[slotDef.id];
        const equipped = resolveGearItem(itemId);
        return {
            id: slotDef.id,
            label: slotDef.label,
            column: slotDef.column,
            row: slotDef.row,
            equipped: equipped
                ? {
                    itemId: equipped.itemId,
                    name: equipped.name,
                    rarity: equipped.rarity || 'common',
                    iconSrc: equipped.iconSrc || '',
                    battleEffect: equipped.battleEffect || '',
                    stats: { ...(equipped.stats || {}) }
                }
                : null
        };
    });

    const statTotals = sumGearStatTotals(slots);
    const perk1Branch = String(
        commander?.ageClassPerkChoices?.perk1 || commander?.ageClassPerk1Branch || ''
    ).trim().toUpperCase();

    return {
        commanderName: username,
        classId,
        classLabel,
        rank,
        path,
        rankTitleGender,
        perk1Branch: perk1Branch === 'A' || perk1Branch === 'B' ? perk1Branch : null,
        portraitSrc: resolveDefaultAvatarUrl(commander, classId),
        classPortraitSrc: CLASS_PORTRAITS[classId] || CLASS_PORTRAITS.battlemaster,
        slots,
        statTotals,
        statLines: buildGearStatLines(statTotals, slots)
    };
}

function buildCommanderAgeGearSeedPatch() {
    return {};
}

module.exports = {
    GEAR_SLOT_ORDER,
    GEAR_ITEMS,
    COMMAND_GEAR_EFFECTIVE_CAP,
    COMMAND_PVP_STARTING_MORALE_BONUS_CAP,
    PVP_COMMAND_MORALE_BATTLE_MODES,
    buildCommanderGearPanelPayload,
    buildCommanderEquipmentBonuses,
    buildCommanderAgeGearSeedPatch,
    resolveEquippedSlotMap,
    commanderHasAcquiredGear,
    resolveEffectiveCommandFromGear,
    resolveCommandPvpAttackerStartingMoraleBonus,
    resolveCommandPvpAttackerStartingMorale,
    isPvpCommandMoraleBattleMode,
    resolveAcquiredGuildTrainingXpMultiplier,
    resolvePreviewGearLoadout
};

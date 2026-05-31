/**
 * NEXUS — Age commander gear (MMORPG equipment slots + stat bonuses).
 */
'use strict';

function resolveCommanderClassId(commander) {
    const rawPath = String(commander?.path || 'PHYS').trim().toUpperCase();
    if (rawPath === 'MAG' || rawPath === 'MAGIC') return 'archmage';
    return 'battlemaster';
}

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

const GEAR_ITEMS = Object.freeze({
    'bm-patrol-blade': {
        name: 'Patrol Blade',
        slot: 'mainHand',
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
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        iconSrc: 'images/classarchmage.png',
        stats: { ranged: 4, morale: 1 }
    },
    'am-arcane-tome': {
        name: 'Arcane Tome',
        slot: 'offHand',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 2, command: 1 }
    },
    'am-circlet': {
        name: 'Circlet of Study',
        slot: 'head',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, guildXp: 0.02 }
    },
    'am-robes': {
        name: 'Scholar Robes',
        slot: 'chest',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 2, injuryMitigation: 0.02 }
    },
    'am-weave-gloves': {
        name: 'Weave Gloves',
        slot: 'hands',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, command: 1 }
    },
    'am-runed-leggings': {
        name: 'Runed Leggings',
        slot: 'legs',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 2 }
    },
    'am-soft-shoes': {
        name: 'Soft Shoes',
        slot: 'feet',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 1, injuryMitigation: 0.01 }
    },
    'am-mystic-cloak': {
        name: 'Mystic Cloak',
        slot: 'cloak',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { ranged: 1, guildXp: 0.02 }
    },
    'am-band-ring': {
        name: 'Band Ring',
        slot: 'ring',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { command: 2 }
    },
    'am-sigil-amulet': {
        name: 'Sigil Amulet',
        slot: 'amulet',
        classId: 'archmage',
        tier: 1,
        rarity: 'common',
        stats: { morale: 2, injuryMitigation: 0.01 }
    },
    'bm-veteran-blade': {
        name: 'Veteran Blade',
        slot: 'mainHand',
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
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        iconSrc: 'images/classarchmage.png',
        stats: { ranged: 6, morale: 2 }
    },
    'am-veteran-tome': {
        name: 'Veteran Tome',
        slot: 'offHand',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 3, command: 2 }
    },
    'am-veteran-circlet': {
        name: 'Veteran Circlet',
        slot: 'head',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, guildXp: 0.03 }
    },
    'am-veteran-robes': {
        name: 'Veteran Robes',
        slot: 'chest',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 3, injuryMitigation: 0.04 }
    },
    'am-veteran-gloves': {
        name: 'Veteran Gloves',
        slot: 'hands',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, command: 2 }
    },
    'am-veteran-leggings': {
        name: 'Veteran Leggings',
        slot: 'legs',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 3 }
    },
    'am-veteran-shoes': {
        name: 'Veteran Shoes',
        slot: 'feet',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 2, injuryMitigation: 0.02 }
    },
    'am-veteran-cloak': {
        name: 'Veteran Cloak',
        slot: 'cloak',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { ranged: 2, guildXp: 0.04 }
    },
    'am-veteran-ring': {
        name: 'Veteran Ring',
        slot: 'ring',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { command: 3 }
    },
    'am-veteran-amulet': {
        name: 'Veteran Amulet',
        slot: 'amulet',
        classId: 'archmage',
        tier: 2,
        rarity: 'uncommon',
        stats: { morale: 3, injuryMitigation: 0.02 }
    }
});

const DEFAULT_LOADOUTS = Object.freeze({
    battlemaster: {
        1: {
            head: 'bm-patrol-helm',
            chest: 'bm-leather-cuirass',
            hands: 'bm-grip-gloves',
            legs: 'bm-march-greaves',
            feet: 'bm-road-boots',
            mainHand: 'bm-patrol-blade',
            offHand: 'bm-training-shield',
            cloak: 'bm-guild-cloak',
            ring: 'bm-signet-ring',
            amulet: 'bm-command-amulet'
        },
        2: {
            head: 'bm-veteran-helm',
            chest: 'bm-veteran-cuirass',
            hands: 'bm-veteran-gloves',
            legs: 'bm-veteran-greaves',
            feet: 'bm-veteran-boots',
            mainHand: 'bm-veteran-blade',
            offHand: 'bm-veteran-shield',
            cloak: 'bm-veteran-cloak',
            ring: 'bm-veteran-ring',
            amulet: 'bm-veteran-amulet'
        }
    },
    archmage: {
        1: {
            head: 'am-circlet',
            chest: 'am-robes',
            hands: 'am-weave-gloves',
            legs: 'am-runed-leggings',
            feet: 'am-soft-shoes',
            mainHand: 'am-focus-staff',
            offHand: 'am-arcane-tome',
            cloak: 'am-mystic-cloak',
            ring: 'am-band-ring',
            amulet: 'am-sigil-amulet'
        },
        2: {
            head: 'am-veteran-circlet',
            chest: 'am-veteran-robes',
            hands: 'am-veteran-gloves',
            legs: 'am-veteran-leggings',
            feet: 'am-veteran-shoes',
            mainHand: 'am-veteran-staff',
            offHand: 'am-veteran-tome',
            cloak: 'am-veteran-cloak',
            ring: 'am-veteran-ring',
            amulet: 'am-veteran-amulet'
        }
    }
});

const CLASS_PORTRAITS = Object.freeze({
    battlemaster: 'images/battlemasterclass.png',
    archmage: 'images/classarchmage.png'
});

const CLASS_LABELS = Object.freeze({
    battlemaster: 'Battlemaster',
    archmage: 'Archmage'
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
    const next = {};
    GEAR_SLOT_ORDER.forEach((slot) => {
        const itemId = String(raw[slot.id] || '').trim();
        if (itemId) next[slot.id] = itemId;
    });
    return Object.keys(next).length ? next : null;
}

function resolveEquippedSlotMap(commander) {
    const persisted = normalizeEquippedSlotMap(commander?.ageGearSlots);
    if (persisted && commander?.ageGearLocked) return persisted;

    const classId = resolveCommanderClassId(commander);
    const tier = resolveGearTierFromRank(resolveCommanderRank(commander));
    return DEFAULT_LOADOUTS[classId]?.[tier] || DEFAULT_LOADOUTS.battlemaster[1];
}

function resolveGearItem(itemId) {
    const id = String(itemId || '').trim();
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
        return { key, label, value, formatted: `+${pct}% ${label}` };
    }

    const rounded = Math.round(value * 10) / 10;
    return { key, label, value: rounded, formatted: `+${rounded} ${label}` };
}

function buildGearStatLines(totals) {
    const order = ['strength', 'ranged', 'morale', 'command', 'injuryMitigation', 'guildXp'];
    return order
        .map((key) => formatStatLine(key, totals[key]))
        .filter(Boolean);
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
                    stats: { ...(equipped.stats || {}) }
                }
                : null
        };
    });

    const statTotals = sumGearStatTotals(slots);

    return {
        commanderName: username,
        classId,
        classLabel,
        rank,
        portraitSrc: resolveDefaultAvatarUrl(commander, classId),
        classPortraitSrc: CLASS_PORTRAITS[classId] || CLASS_PORTRAITS.battlemaster,
        slots,
        statTotals,
        statLines: buildGearStatLines(statTotals)
    };
}

function buildCommanderAgeGearSeedPatch() {
    return {};
}

module.exports = {
    GEAR_SLOT_ORDER,
    GEAR_ITEMS,
    buildCommanderGearPanelPayload,
    buildCommanderEquipmentBonuses,
    buildCommanderAgeGearSeedPatch,
    resolveEquippedSlotMap
};

/**
 * NEXUS — Commander gear hand-slot rules (one-hand, two-hand, shield, dual wield).
 */
'use strict';

function resolveGearHandedness(item) {
    if (!item) return null;
    if (item.handedness === 'oneHand' || item.handedness === 'twoHand') {
        return item.handedness;
    }
    if (item.slot === 'mainHand') return 'oneHand';
    return null;
}

function resolveOffHandType(item) {
    if (!item) return null;
    if (item.offHandType === 'shield' || item.offHandType === 'dualWield') {
        return item.offHandType;
    }
    if (item.slot === 'offHand') return 'shield';
    return null;
}

function itemAllowsDualWieldOffHand(item) {
    return Boolean(item?.dualWieldOffHand) && resolveGearHandedness(item) === 'oneHand';
}

function canEquipGearItemToSlot(item, targetSlot, equipped, resolveItemById) {
    const slot = String(targetSlot || '').trim();
    const resolveItem = typeof resolveItemById === 'function' ? resolveItemById : ((id) => id);
    const itemSlot = String(item?.slot || '').trim();

    if (!item || !slot || !itemSlot) {
        return { ok: false, reason: 'invalid_item' };
    }

    if (slot === 'offHand') {
        if (itemSlot === 'offHand' && resolveOffHandType(item) === 'shield') {
            const mainItem = resolveItem(equipped?.mainHand);
            if (mainItem && resolveGearHandedness(mainItem) === 'twoHand') {
                return { ok: false, reason: 'two_handed_main_blocks_off_hand' };
            }
            return { ok: true, slot: 'offHand' };
        }

        if (itemAllowsDualWieldOffHand(item)) {
            const mainItem = resolveItem(equipped?.mainHand);
            const mainHandedness = resolveGearHandedness(mainItem);
            if (!mainItem || mainHandedness === 'twoHand') {
                return { ok: false, reason: 'dual_wield_needs_one_hand_main' };
            }
            if (!itemAllowsDualWieldOffHand(mainItem)) {
                return { ok: false, reason: 'main_not_dual_wield_capable' };
            }
            return { ok: true, slot: 'offHand' };
        }

        return { ok: false, reason: 'off_hand_not_eligible' };
    }

    if (slot === 'mainHand') {
        if (itemSlot !== 'mainHand') {
            return { ok: false, reason: 'wrong_slot' };
        }
        return { ok: true, slot: 'mainHand' };
    }

    if (slot !== itemSlot) {
        return { ok: false, reason: 'wrong_slot' };
    }

    return { ok: true, slot };
}

function resolveDefaultEquipSlot(item, preferredSlot) {
    const preferred = String(preferredSlot || '').trim();
    if (preferred) return preferred;
    return String(item?.slot || '').trim();
}

function sanitizeEquippedSlotMap(rawEquipped, resolveItemById) {
    if (!rawEquipped || typeof rawEquipped !== 'object') return {};
    const resolveItem = typeof resolveItemById === 'function' ? resolveItemById : ((id) => id);
    const next = {};

    Object.entries(rawEquipped).forEach(([slotId, itemId]) => {
        const id = String(itemId || '').trim();
        if (!id) return;
        next[slotId] = id;
    });

    const mainItem = resolveItem(next.mainHand);
    if (mainItem && resolveGearHandedness(mainItem) === 'twoHand' && next.offHand) {
        delete next.offHand;
    }

    if (next.offHand) {
        const offItem = resolveItem(next.offHand);
        const check = canEquipGearItemToSlot(offItem, 'offHand', next, resolveItem);
        if (!check.ok) {
            delete next.offHand;
        }
    }

    return next;
}

function describeEquipSlotFailure(reason) {
    switch (String(reason || '').trim()) {
        case 'two_handed_main_blocks_off_hand':
            return 'Two-handed weapons use both hands — stow your off-hand item first.';
        case 'dual_wield_needs_one_hand_main':
            return 'Dual wield off-hand gear requires a one-handed main weapon.';
        case 'main_not_dual_wield_capable':
            return 'Your main weapon is not dual-wield capable.';
        case 'off_hand_not_eligible':
            return 'That item cannot be equipped in the off hand.';
        case 'wrong_slot':
            return 'That item cannot be equipped in this slot.';
        default:
            return 'That item cannot be equipped right now.';
    }
}

module.exports = {
    resolveGearHandedness,
    resolveOffHandType,
    itemAllowsDualWieldOffHand,
    canEquipGearItemToSlot,
    resolveDefaultEquipSlot,
    sanitizeEquippedSlotMap,
    describeEquipSlotFailure
};

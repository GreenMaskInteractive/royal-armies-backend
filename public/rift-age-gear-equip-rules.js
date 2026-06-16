/**
 * RIFT — Commander gear hand-slot rules (one-hand, two-hand, shield, dual wield).
 */
(function initRoyalArmiesGearEquipRules(global) {
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

    function resolveEquipTargetSlot(item, equipped, resolveItemById) {
        const resolveItem = typeof resolveItemById === 'function' ? resolveItemById : ((id) => id);
        const defaultSlot = String(item?.slot || '').trim();
        const equippedMap = equipped && typeof equipped === 'object' ? equipped : {};

        if (defaultSlot && defaultSlot !== 'mainHand' && defaultSlot !== 'offHand') {
            return defaultSlot;
        }

        if (defaultSlot === 'offHand') {
            return 'offHand';
        }

        const mainOccupied = String(equippedMap.mainHand || '').trim();
        const offCheck = canEquipGearItemToSlot(item, 'offHand', equippedMap, resolveItem);
        const mainCheck = canEquipGearItemToSlot(item, 'mainHand', equippedMap, resolveItem);

        if (itemAllowsDualWieldOffHand(item) && mainOccupied && mainOccupied !== item.id) {
            const mainItem = resolveItem(mainOccupied);
            if (mainItem && itemAllowsDualWieldOffHand(mainItem) && offCheck.ok) {
                return 'offHand';
            }
        }

        if (mainCheck.ok) return 'mainHand';
        if (offCheck.ok) return 'offHand';
        return defaultSlot || 'mainHand';
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

    function formatHandSlotMeta(item) {
        if (!item) return '';
        if (resolveGearHandedness(item) === 'twoHand') return 'Two-handed';
        if (itemAllowsDualWieldOffHand(item)) return 'One-handed · Dual wield';
        if (item.slot === 'offHand') return 'Shield';
        if (item.slot === 'mainHand') return 'One-handed';
        return '';
    }

    global.RoyalArmiesGearEquipRules = Object.freeze({
        resolveGearHandedness,
        resolveOffHandType,
        itemAllowsDualWieldOffHand,
        canEquipGearItemToSlot,
        resolveEquipTargetSlot,
        sanitizeEquippedSlotMap,
        describeEquipSlotFailure,
        formatHandSlotMeta
    });
}(typeof window !== 'undefined' ? window : globalThis));

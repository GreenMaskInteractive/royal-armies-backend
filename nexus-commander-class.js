/**
 * NEXUS — Canonical commander class/path identity helpers.
 *
 * SINGLE SOURCE OF TRUTH (server side) for mapping a commander's ledger
 * `path` value ('PHYS' | 'MAG', legacy 'MAGIC') to a class id
 * ('battlemaster' | 'battlemage'), plus display labels and portraits.
 *
 * Every NEXUS module that needs class identity must require this file
 * instead of re-implementing the mapping. The client-side mirror is
 * public/rift-commander-rank-titles.js (global RoyalArmiesCommanderRankTitles).
 *
 * If a class is ever renamed or added, this file + the client mirror are
 * the only two places the path→class mapping should change.
 */
'use strict';

const COMMANDER_CLASS_IDS = Object.freeze(['battlemaster', 'battlemage']);

const COMMANDER_CLASS_LABELS = Object.freeze({
    battlemaster: 'Battlemaster',
    battlemage: 'Battlemage'
});

const COMMANDER_CLASS_PORTRAITS = Object.freeze({
    battlemaster: 'images/battlemasterclass.png',
    // Image filename retains the legacy "archmage" asset name on purpose.
    battlemage: 'images/classarchmage.png'
});

/**
 * Normalize a raw path value to a canonical ledger path code.
 * Returns 'PHYS' | 'MAG' or null when unrecognized (callers decide the default).
 */
function normalizeClassPathCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (code === 'MAGIC') return 'MAG';
    if (code === 'MAG' || code === 'PHYS') return code;
    return null;
}

/** Map a path code to a class id; unknown/missing paths default to battlemaster. */
function resolveClassIdFromPath(pathCode) {
    return normalizeClassPathCode(pathCode) === 'MAG' ? 'battlemage' : 'battlemaster';
}

/** Convenience: class id straight from a commander ledger record. */
function resolveCommanderClassId(commander) {
    return resolveClassIdFromPath(commander?.path);
}

function getCommanderClassLabel(classId) {
    return COMMANDER_CLASS_LABELS[classId] || COMMANDER_CLASS_LABELS.battlemaster;
}

function getCommanderClassPortrait(classId) {
    return COMMANDER_CLASS_PORTRAITS[classId] || COMMANDER_CLASS_PORTRAITS.battlemaster;
}

module.exports = {
    COMMANDER_CLASS_IDS,
    COMMANDER_CLASS_LABELS,
    COMMANDER_CLASS_PORTRAITS,
    normalizeClassPathCode,
    resolveClassIdFromPath,
    resolveCommanderClassId,
    getCommanderClassLabel,
    getCommanderClassPortrait
};

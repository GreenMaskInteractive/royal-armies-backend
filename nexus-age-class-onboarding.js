/**
 * NEXUS — Age class + Perk 1 onboarding (Battlemaster / Battlemage path).
 */
'use strict';

const VALID_PATH_CODES = new Set(['PHYS', 'MAG', 'MAGIC']);
const VALID_PERK1_BRANCHES = new Set(['A', 'B', 'BUFF', 'COVER', 'OFFENSE', 'DEFENSE']);

function normalizeClassPathCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (code === 'MAGIC') return 'MAG';
    if (code === 'MAG' || code === 'PHYS') return code;
    return null;
}

function normalizeClassPerk1Branch(raw) {
    const value = String(raw || '').trim().toUpperCase();
    if (value === 'A' || value === 'BUFF' || value === 'OFFENSE') return 'A';
    if (value === 'B' || value === 'COVER' || value === 'DEFENSE') return 'B';
    return null;
}

function resolveClassIdFromPath(pathCode) {
    const path = normalizeClassPathCode(pathCode);
    return path === 'MAG' ? 'battlemage' : 'battlemaster';
}

function commanderHasLockedClassChoice(commander) {
    const choices = commander?.ageClassPerkChoices;
    const perk1 = normalizeClassPerk1Branch(choices?.perk1 || choices?.perk1Branch || commander?.ageClassPerk1Branch);
    const path = normalizeClassPathCode(commander?.path);
    return Boolean(path && perk1 && commander?.ageClassConfirmedAt);
}

function buildClassOnboardingPatch(body, commander, options = {}) {
    const pathCode = normalizeClassPathCode(body?.path || body?.pathCode);
    const perk1 = normalizeClassPerk1Branch(body?.perk1 || body?.perk1Branch || body?.ageClassPerk1Branch);
    const allowClassReselect = options?.allowClassReselect === true;

    if (!pathCode) {
        return { errorCode: 'NEXUS-GAME-018', message: 'Invalid class path.' };
    }
    if (!perk1) {
        return { errorCode: 'NEXUS-GAME-019', message: 'Perk 1 branch (A or B) is required.' };
    }

    if (commanderHasLockedClassChoice(commander)) {
        const existingPath = normalizeClassPathCode(commander.path);
        const existingPerk = normalizeClassPerk1Branch(
            commander?.ageClassPerkChoices?.perk1 || commander?.ageClassPerk1Branch
        );
        if (existingPath !== pathCode || existingPerk !== perk1) {
            if (!allowClassReselect) {
                return { errorCode: 'NEXUS-GAME-020', message: 'Class and Perk 1 choices are already locked for this Age.' };
            }
            return {
                ok: true,
                patch: {
                    path: pathCode,
                    ageClassPerkChoices: { perk1 },
                    ageClassPerk1Branch: perk1,
                    ageClassConfirmedAt: commander?.ageClassConfirmedAt || new Date().toISOString()
                },
                path: pathCode,
                classId: resolveClassIdFromPath(pathCode),
                perk1Branch: perk1,
                alreadySaved: false,
                classReselected: true
            };
        }
        return {
            ok: true,
            patch: {},
            path: existingPath,
            classId: resolveClassIdFromPath(existingPath),
            perk1Branch: existingPerk,
            alreadySaved: true
        };
    }

    return {
        ok: true,
        patch: {
            path: pathCode,
            ageClassPerkChoices: { perk1 },
            ageClassPerk1Branch: perk1,
            ageClassConfirmedAt: commander?.ageClassConfirmedAt || new Date().toISOString()
        },
        path: pathCode,
        classId: resolveClassIdFromPath(pathCode),
        perk1Branch: perk1,
        alreadySaved: false
    };
}

module.exports = {
    normalizeClassPathCode,
    normalizeClassPerk1Branch,
    resolveClassIdFromPath,
    commanderHasLockedClassChoice,
    buildClassOnboardingPatch
};

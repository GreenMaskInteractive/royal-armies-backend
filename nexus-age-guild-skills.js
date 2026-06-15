/**
 * NEXUS — Adventurer's Guild unlock skills (trade escort gates, etc.).
 */
'use strict';

const GUILD_UNLOCK_SKILL_IDS = Object.freeze({
    merchantsAssistant: 'merchants-assistant'
});

const GUILD_UNLOCK_SKILL_LABELS = Object.freeze({
    'merchants-assistant': "Merchant's Assistant"
});

function normalizeGuildUnlockSkillIds(commander) {
    const raw = commander?.ageGuildUnlockSkills;
    if (!Array.isArray(raw)) return [];
    return raw.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean);
}

function commanderHasGuildUnlockSkill(commander, skillId) {
    const id = String(skillId || '').trim().toLowerCase();
    if (!id) return true;
    return normalizeGuildUnlockSkillIds(commander).includes(id);
}

function formatGuildUnlockSkillLabel(skillId) {
    const id = String(skillId || '').trim().toLowerCase();
    return GUILD_UNLOCK_SKILL_LABELS[id] || skillId;
}

module.exports = {
    GUILD_UNLOCK_SKILL_IDS,
    GUILD_UNLOCK_SKILL_LABELS,
    normalizeGuildUnlockSkillIds,
    commanderHasGuildUnlockSkill,
    formatGuildUnlockSkillLabel
};

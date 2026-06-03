/**
 * NEXUS / RIFT — Player report categories (single source of truth).
 * Loaded in MAP before rift-player-report.js; required by nexus-player-reports.js on the server.
 */
'use strict';

const REPORT_CATEGORY_GROUPS = [
    {
        id: 'conduct_communication',
        label: 'Conduct & communication',
        categories: [
            {
                id: 'harassment',
                label: 'Harassment or bullying',
                hint: 'Who was targeted, where it happened (world chat, mail, profile), and whether it is ongoing or repeated.'
            },
            {
                id: 'threats',
                label: 'Threats of violence or real-world harm',
                hint: 'Quote or paraphrase the threat, when it was sent, and the channel (chat, mail, external contact).'
            },
            {
                id: 'hate_speech',
                label: 'Hate speech, slurs, or discrimination',
                hint: 'Include slurs or discriminatory language used and the context (public chat, mail, profile, nation/guild).'
            },
            {
                id: 'sexual_content',
                label: 'Sexual or sexually explicit content',
                hint: 'Where it appeared (chat, mail, commander name, avatar, bio) and whether minors may be involved.'
            },
            {
                id: 'toxic_language',
                label: 'Extreme toxicity or targeted profanity',
                hint: 'Describe the pattern (not a single slip) and where moderators can find messages or logs.'
            }
        ]
    },
    {
        id: 'spam_scams',
        label: 'Spam, ads & scams',
        categories: [
            {
                id: 'spam',
                label: 'Spam or chat flooding',
                hint: 'Approximate time, channel, and whether the same message was repeated or automated.'
            },
            {
                id: 'advertising',
                label: 'Unsolicited advertising or recruitment',
                hint: 'What was advertised (other game, Discord, website) and where it was posted.'
            },
            {
                id: 'scam_phishing',
                label: 'Scam, phishing, or malicious links',
                hint: 'Paste or describe links/messages and what the player asked others to do (login, pay, trade off-site).'
            }
        ]
    },
    {
        id: 'fair_play',
        label: 'Fair play & game integrity',
        categories: [
            {
                id: 'cheating',
                label: 'Cheating, hacks, or third-party tools',
                hint: 'What unfair advantage you observed (stats, battles, map) and any evidence (screenshots, battle IDs, timestamps).'
            },
            {
                id: 'botting',
                label: 'Botting, scripting, or macros',
                hint: 'Describe automated behavior (24/7 activity, identical timing, impossible actions) and where you saw it.'
            },
            {
                id: 'multi_account',
                label: 'Multiple accounts or ban evasion',
                hint: 'List usernames you believe are the same player and why (shared behavior, naming, alliance patterns).'
            },
            {
                id: 'exploit_abuse',
                label: 'Bug or exploit abuse',
                hint: 'What exploit was used, when, and how it affected kingdoms, battles, resources, or rankings.'
            },
            {
                id: 'collusion',
                label: 'Collusion, win trading, or rigged outcomes',
                hint: 'Which commanders or alliances coordinated, and which battles, votes, or events were affected.'
            },
            {
                id: 'griefing',
                label: 'Griefing or intentionally destructive play',
                hint: 'Actions taken to harm allies or the realm without strategic purpose (sabotage, trolling sieges, etc.).'
            },
            {
                id: 'nation_abuse',
                label: 'Nation, guild, or alliance sabotage / espionage',
                hint: 'Spy accounts, leaked plans, internal sabotage, or abuse of officer powers—include roles if known.'
            }
        ]
    },
    {
        id: 'economy_accounts',
        label: 'Economy & account abuse',
        categories: [
            {
                id: 'rmt',
                label: 'Real-money trading (RMT) or account selling',
                hint: 'Off-site payment method, advertised prices, and where the offer was made (chat, mail, profile).'
            },
            {
                id: 'trade_scam',
                label: 'In-game trade, gift, or marketplace scam',
                hint: 'What was promised vs. delivered, usernames involved, and approximate date/time of the trade.'
            },
            {
                id: 'chargeback_fraud',
                label: 'Payment or chargeback fraud',
                hint: 'If known, describe premium/currency issues tied to this commander and any public boasts about chargebacks.'
            }
        ]
    },
    {
        id: 'identity_profile',
        label: 'Identity & profile',
        categories: [
            {
                id: 'impersonation',
                label: 'Impersonation of player, leader, or staff',
                hint: 'Who they impersonate (commander, guild leader, moderator) and misleading name, mail, or messages.'
            },
            {
                id: 'inappropriate_profile',
                label: 'Offensive commander name, avatar, or bio',
                hint: 'Quote the name or bio text and note if it targets a person, group, or real-world tragedy.'
            },
            {
                id: 'doxxing',
                label: 'Doxxing or sharing private information',
                hint: 'What personal information was shared (without repeating it fully) and where it was posted.'
            }
        ]
    },
    {
        id: 'safety',
        label: 'Safety & sensitive concerns',
        categories: [
            {
                id: 'underage',
                label: 'Possible underage player',
                hint: 'Why you believe the player may be under the minimum age; do not share private details about minors.'
            },
            {
                id: 'self_harm',
                label: 'Self-harm or suicide references',
                hint: 'When and where statements were made; if there is immediate danger, contact local emergency services.'
            },
            {
                id: 'irl_coercion',
                label: 'Real-life threats or coercion (trades, alliances)',
                hint: 'Describe pressure or threats outside the game tied to in-game demands, without posting private info.'
            }
        ]
    },
    {
        id: 'other',
        label: 'Other',
        categories: [
            {
                id: 'other',
                label: 'Other rule violation',
                hint: 'Summarize the rule broken, where it occurred, and what moderators should review first.'
            }
        ]
    }
];

/** @deprecated ids mapped for older reports stored in the ledger */
const LEGACY_CATEGORY_ALIASES = {};

const DEFAULT_DETAILS_PLACEHOLDER =
    'Describe the incident with enough detail for moderators to investigate (dates, channels, quotes, battle or mail references, etc.).';

function buildReportCategoriesMap() {
    const map = Object.create(null);
    REPORT_CATEGORY_GROUPS.forEach((group) => {
        group.categories.forEach((cat) => {
            map[cat.id] = {
                id: cat.id,
                label: cat.label,
                hint: cat.hint || '',
                groupId: group.id,
                groupLabel: group.label
            };
        });
    });
    return map;
}

const REPORT_CATEGORIES = buildReportCategoriesMap();

function normalizeReportCategory(value) {
    const key = String(value || '').trim().toLowerCase();
    if (REPORT_CATEGORIES[key]) return key;
    const alias = LEGACY_CATEGORY_ALIASES[key];
    if (alias && REPORT_CATEGORIES[alias]) return alias;
    return '';
}

const catalog = {
    REPORT_CATEGORY_GROUPS,
    REPORT_CATEGORIES,
    LEGACY_CATEGORY_ALIASES,
    DEFAULT_DETAILS_PLACEHOLDER,
    normalizeReportCategory
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = catalog;
}
if (typeof globalThis !== 'undefined') {
    globalThis.RoyalArmiesPlayerReportCatalog = catalog;
}

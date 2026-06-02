/**
 * RIFT — Master Language Network (Continent of Amnek).
 * Bi-directional English ↔ regional dialect translation per continental linguistics spec.
 */
(function initRoyalArmiesAmnekLanguageNetwork(global) {
    'use strict';

    const DIALECT_IDS = Object.freeze({
        woodland: 'woodland',
        ridge: 'ridge',
        basin: 'basin',
        gulf: 'gulf',
        reach: 'reach'
    });

    const REGION_DIALECT = Object.freeze({
        'region-2': DIALECT_IDS.woodland,
        'region-3': DIALECT_IDS.ridge,
        'region-4': DIALECT_IDS.basin,
        'region-5': DIALECT_IDS.gulf,
        'region-6': DIALECT_IDS.reach
    });

    const NATION_DIALECT = Object.freeze({
        krall: DIALECT_IDS.woodland,
        aethelgard: DIALECT_IDS.woodland,
        saelthine: DIALECT_IDS.woodland,
        dravic: DIALECT_IDS.ridge,
        aesthene: DIALECT_IDS.ridge,
        vaerenth: DIALECT_IDS.ridge,
        thruun: DIALECT_IDS.basin,
        zevros: DIALECT_IDS.basin,
        vaelior: DIALECT_IDS.gulf,
        skaros: DIALECT_IDS.gulf,
        mynor: DIALECT_IDS.reach,
        khaerant: DIALECT_IDS.reach
    });

    const REGION_LABELS = Object.freeze({
        'region-2': 'North-Gale Woodlands',
        'region-3': 'Crescent Ridge',
        'region-4': 'Verdant Basin',
        'region-5': 'Wyrmtooth Gulf',
        'region-6': 'Dreadforge Reach'
    });

    function entry(term, phonetic, englishKeys) {
        return { term, phonetic, englishKeys: Array.isArray(englishKeys) ? englishKeys : [englishKeys] };
    }

    const DIALECTS = Object.freeze({
        [DIALECT_IDS.woodland]: {
            id: DIALECT_IDS.woodland,
            name: 'Woodland Dialect',
            regionName: 'North-Gale Woodlands',
            profile: 'Harsh, hissing, untamed — guttural starts, voiceless fricatives, abrupt stops.',
            syntax: 'OVS',
            wordOrder: ['object', 'verb', 'subject'],
            stripArticles: true,
            entries: [
                entry('Khra', 'xrɑː', ['burn', 'burns', 'burning']),
                entry('Zhah', 'ʒɑː', ['all', 'everything']),
                entry('Ghu', 'ɣuː', ['river']),
                entry('Num', 'nʌm', ['blood']),
                entry('Vkhro', 'vxroʊ', ['mercy']),
                entry('Kagh', 'kɑːg', ['no', 'anti']),
                entry('Morkh', 'mɔːrx', ['everyone', 'human', 'humans']),
                entry('Taz', 'tæz', ['dies', 'death', 'die']),
                entry('Skhra', 'skxrɑː', ['warrior', 'raider', 'raiders']),
                entry('Gale', 'geɪl', ['forest', 'forests', 'trees', 'tree'])
            ],
            pluralPrefix: 'vkh-',
            pastSuffix: '-ag',
            phoneticSeed: ['khr', 'zh', 'vkh', 'gh', 'sk', 'morkh']
        },
        [DIALECT_IDS.ridge]: {
            id: DIALECT_IDS.ridge,
            name: 'Ridge Dialect',
            regionName: 'Crescent Ridge',
            profile: 'Sharp, staccato, piercing — rigid military cadence.',
            syntax: 'SVO',
            wordOrder: ['subject', 'verb', 'object'],
            stripArticles: true,
            entries: [
                entry('Krah-voh', 'krɑː-voʊ', ['stand', 'hold']),
                entry('Lah', 'lɑː', ['fast', 'firm']),
                entry('Forti', 'fɔːrti', ['strength', 'fortitude']),
                entry('Ordum', 'ɔːrdʌm', ['arise', 'awaken', 'awakens']),
                entry('Savar', 'sævɑːr', ['shield', 'shields', 'protect']),
                entry('Ah', 'ɑː', ['wall', 'barrier']),
                entry('Mor', 'mɔːr', ['defy', 'resist']),
                entry('Talis', 'tæliːs', ['death', 'mortal']),
                entry('Taru', 'tɑːruː', ['fall', 'fail']),
                entry('Reximus', 'rɛksiːmʌs', ['conquer', 'win'])
            ],
            pluralSuffix: '-is',
            imperativePrefix: 'Ex-',
            compoundJoiner: '-',
            phoneticSeed: ['kr', 't', 'p', 'r', 'lah', 'forti', 'ex']
        },
        [DIALECT_IDS.basin]: {
            id: DIALECT_IDS.basin,
            name: 'Basin Dialect',
            regionName: 'Verdant Basin',
            profile: 'Guttural, loose, open-voweled — words bleed together.',
            syntax: 'SOV',
            wordOrder: ['subject', 'object', 'verb'],
            stripArticles: true,
            entries: [
                entry('Khah', 'xɑː', ['land', 'home']),
                entry('Agh', 'æg', ['pour', 'serve']),
                entry('Gora', 'gɔːrɑː', ['ale', 'drink']),
                entry('Kharah', 'xɑːrɑː', ['drink']),
                entry('Zho', 'ʒoʊ', ['down', 'inside']),
                entry('Laguz', 'lɑːgʌz', ['count', 'counts', 'trade']),
                entry('Num', 'nʌm', ['gold', 'wealth']),
                entry('Ghuz', 'gʌz', ['cheers', 'feast']),
                entry('Zev', 'zɛv', ['merchant', 'friend']),
                entry('Ros', 'rɒs', ['thief', 'rogue'])
            ],
            pluralVowelDouble: true,
            phoneticSeed: ['gh', 'gora', 'um', 'uz', 'khah', 'laguz', 'zev']
        },
        [DIALECT_IDS.gulf]: {
            id: DIALECT_IDS.gulf,
            name: 'Gulf Dialect',
            regionName: 'Wyrmtooth Gulf',
            profile: 'Smooth, flowing, melodic — spiritual, poetic, oceanic.',
            syntax: 'VSO',
            wordOrder: ['verb', 'subject', 'object'],
            stripArticles: true,
            entries: [
                entry('Ahla', 'ɑːlɑː', ['remember', 'honor']),
                entry('Ohla', 'oʊlɑː', ['mourn', 'mourns', 'loss']),
                entry('Ahi', 'ɑːhiː', ['first', 'ancient']),
                entry('Lor', 'lɔːr', ['children', 'clans', 'child']),
                entry('Lwis', 'lwiːs', ['vision', 'sight']),
                entry('Meen', 'miːn', ['beautiful', 'lush']),
                entry('Maliva', 'mæliːvɑː', ['gone', 'dust']),
                entry('Ashora', 'æʃɔːrɑː', ['we remain', 'remain']),
                entry('Va', 'vɑː', ['last', 'final']),
                entry('Lior', 'liːɔːr', ['bloodline', 'kin'])
            ],
            femininePrefix: 'Sha-',
            neutralPrefix: 'Eru-',
            forbiddenConsonants: ['k', 'p'],
            phoneticSeed: ['ah', 'oh', 'sha', 'eru', 'lor', 'lwis', 'meen', 'lior']
        },
        [DIALECT_IDS.reach]: {
            id: DIALECT_IDS.reach,
            name: 'Reach Dialect',
            regionName: 'Dreadforge Reach',
            profile: 'Rigid, imperial, heavy — mechanical, case-inflected.',
            syntax: 'CASE',
            wordOrder: null,
            stripArticles: true,
            entries: [
                entry('Ikpek', 'ɪkpɛk', ['empire', 'crown']),
                entry('Taktik', 'tæktɪk', ['order', 'plan']),
                entry('Vakrok', 'vækrɒk', ['valor', 'worth']),
                entry('Kertis', 'kɛrtiːs', ['certainty', 'law']),
                entry('Khaer', 'xeɪɔːr', ['host', 'ruler']),
                entry('Myn', 'mɪn', ['labor', 'pit']),
                entry('Pru', 'pruː', ['gold', 'currency']),
                entry('Form', 'fɔːrm', ['serve', 'obeys', 'obey']),
                entry('Tenz', 'tɛnz', ['guard', 'guards', 'iron']),
                entry('Kraz', 'kræz', ['secede', 'divide'])
            ],
            subjectCaseSuffix: 'um',
            objectCaseSuffix: 'tas',
            eliteVerbSuffix: 'vass',
            phoneticSeed: ['ik', 'pru', 'tas', 'tenz', 'taktik', 'form', 'khaer']
        }
    });

    const ARTICLE_WORDS = new Set(['the', 'a', 'an']);

    function normalizeToken(raw) {
        return String(raw || '').toLowerCase().replace(/[^a-z'/]/g, '').trim();
    }

    function buildLookupIndexes() {
        const englishToDialect = {};
        const dialectToEnglish = {};

        Object.keys(DIALECTS).forEach((dialectId) => {
            englishToDialect[dialectId] = Object.create(null);
            dialectToEnglish[dialectId] = Object.create(null);
            const dialect = DIALECTS[dialectId];

            dialect.entries.forEach((row) => {
                const termKey = normalizeToken(row.term);
                dialectToEnglish[dialectId][termKey] = row;

                row.englishKeys.forEach((keyPhrase) => {
                    String(keyPhrase).split(/\s+/).forEach((word) => {
                        const token = normalizeToken(word);
                        if (!token) return;
                        if (!englishToDialect[dialectId][token]) {
                            englishToDialect[dialectId][token] = row;
                        }
                    });
                    const phraseKey = normalizeToken(keyPhrase.replace(/\s+/g, ' '));
                    if (phraseKey.includes(' ')) {
                        englishToDialect[dialectId][phraseKey] = row;
                    }
                });
            });
        });

        return { englishToDialect, dialectToEnglish };
    }

    const LOOKUP = buildLookupIndexes();

    function resolveDialectId(dialectOrRegionOrNation) {
        const raw = String(dialectOrRegionOrNation || '').trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        if (DIALECTS[lower]) return lower;
        if (REGION_DIALECT[raw]) return REGION_DIALECT[raw];
        if (NATION_DIALECT[lower]) return NATION_DIALECT[lower];
        return null;
    }

    function getDialectMeta(dialectId) {
        const id = resolveDialectId(dialectId);
        return id ? DIALECTS[id] : null;
    }

    function lookupEnglishWord(dialectId, token) {
        const id = resolveDialectId(dialectId);
        if (!id) return null;
        return LOOKUP.englishToDialect[id][normalizeToken(token)] || null;
    }

    function applyWoodlandGrammar(term, role, options) {
        let out = term;
        if (options.plural && role !== 'verb') {
            out = `vkh-${out}`;
        }
        if (options.past && role === 'verb') {
            out = `${out}-ag`;
        }
        return out.toLowerCase();
    }

    function applyRidgeGrammar(term, role, options) {
        let out = term;
        if (options.plural && role !== 'verb') {
            const base = out.replace(/-is$/i, '').toLowerCase();
            out = base.endsWith('r') ? `${base}is` : `${base}-is`;
            if (base === 'savar') out = 'Savaris';
        }
        if (options.imperative && role === 'verb') {
            const base = out.replace(/^ex-/i, '').toLowerCase();
            return `Ex-${base}`;
        }
        return out.toLowerCase();
    }

    function applyBasinGrammar(term, role, options) {
        let out = term;
        if (options.plural && role !== 'verb') {
            const match = out.match(/^([aeiou])(.*)$/i);
            if (match) {
                out = `${match[1]}${match[1]}${match[2]}`;
            }
        }
        return out.toLowerCase();
    }

    function applyGulfGrammar(term, role, options) {
        let out = term;
        if (options.feminine && role !== 'verb') {
            out = `Sha-${out}`;
        } else if (options.neutral && role !== 'verb') {
            out = `Eru-${out}`;
        }
        return out.toLowerCase();
    }

    function applyReachCase(term, role, options) {
        const base = term.replace(/(-um|-tas|-vass)$/i, '');
        if (role === 'subject') {
            return `${base}${DIALECTS[DIALECT_IDS.reach].subjectCaseSuffix}`.toLowerCase();
        }
        if (role === 'object') {
            return `${base}${DIALECTS[DIALECT_IDS.reach].objectCaseSuffix}`.toLowerCase();
        }
        let verb = base.toLowerCase();
        if (options.eliteAddress) {
            verb = `${verb}${DIALECTS[DIALECT_IDS.reach].eliteVerbSuffix}`;
        }
        return verb;
    }

    function formatTerm(dialectId, row, role, options) {
        if (!row) return '';
        const dialect = DIALECTS[resolveDialectId(dialectId)];
        const base = row.term.split(/\s*\/\s*/)[0].trim();

        switch (dialect.id) {
            case DIALECT_IDS.woodland:
                return applyWoodlandGrammar(base, role, options);
            case DIALECT_IDS.ridge:
                return applyRidgeGrammar(base, role, options);
            case DIALECT_IDS.basin:
                return applyBasinGrammar(base, role, options);
            case DIALECT_IDS.gulf:
                return applyGulfGrammar(base, role, options);
            case DIALECT_IDS.reach:
                if (role === 'verb') return applyReachCase(base, 'verb', options);
                return applyReachCase(base, role, options);
            default:
                return base.toLowerCase();
        }
    }

    function synthesizeTerm(dialectId, englishToken) {
        const id = resolveDialectId(dialectId);
        const dialect = DIALECTS[id];
        const token = normalizeToken(englishToken);
        if (!token || !dialect) return token;

        const seed = dialect.phoneticSeed[token.length % dialect.phoneticSeed.length];
        const body = token.replace(/[^a-z]/g, '').slice(0, 4);
        let composed = `${seed}${body}`.replace(/[kp]/gi, (match) => {
            if (id === DIALECT_IDS.gulf) return 'sh';
            return match;
        });

        if (id === DIALECT_IDS.ridge && body.length > 2) {
            composed = `${composed.slice(0, 3)}-${composed.slice(3, 5)}`;
        }

        return composed.toLowerCase();
    }

    function resolveEnglishToken(dialectId, token, options) {
        const row = lookupEnglishWord(dialectId, token);
        if (row) {
            return formatTerm(dialectId, row, options.role || 'noun', options);
        }
        return synthesizeTerm(dialectId, token);
    }

    /** Structured translation — preferred for accurate output. */
    function translateStructured(dialectId, clause) {
        const id = resolveDialectId(dialectId);
        const dialect = DIALECTS[id];
        if (!dialect || !clause || !clause.verb) {
            return { dialectId: id, text: '', syntax: null, steps: [] };
        }

        const grammarOpts = {
            imperative: !!clause.imperative,
            past: !!clause.past,
            plural: !!(clause.plural && (clause.plural.subject || clause.plural.object)),
            feminine: !!clause.feminine,
            neutral: !!clause.neutral,
            eliteAddress: !!clause.eliteAddress
        };

        function resolveRolePiece(value, role) {
            if (!value) return '';
            if (Array.isArray(value)) {
                return value.map((part) => resolveRolePiece(part, role)).filter(Boolean).join(' ');
            }
            if (typeof value === 'object' && value.term) {
                return formatTerm(id, value, role, { ...grammarOpts, role, plural: clause.plural && clause.plural[role] });
            }
            const token = String(value);
            const row = lookupEnglishWord(id, token);
            return formatTerm(id, row || { term: synthesizeTerm(id, token) }, role, {
                ...grammarOpts,
                role,
                plural: clause.plural && clause.plural[role === 'subject' ? 'subject' : 'object']
            });
        }

        const verbRow = typeof clause.verb === 'object'
            ? clause.verb
            : (lookupEnglishWord(id, clause.verb) || { term: synthesizeTerm(id, clause.verb) });
        const verbText = formatTerm(id, verbRow, 'verb', grammarOpts);

        const subjectText = resolveRolePiece(clause.subject, 'subject');
        const objectText = resolveRolePiece(clause.object, 'object');

        const steps = [];
        let ordered = [];

        if (dialect.syntax === 'CASE') {
            const subj = subjectText || '';
            const obj = objectText || '';
            ordered = [subj, obj, verbText].filter(Boolean);
            steps.push('Reach: subject -um, object -tas, verb last.');
        } else {
            const roleMap = {
                subject: subjectText,
                verb: verbText,
                object: objectText
            };
            ordered = (dialect.wordOrder || []).map((role) => roleMap[role]).filter(Boolean);
            steps.push(`${dialect.name}: ${dialect.syntax} word order.`);
        }

        return {
            dialectId: id,
            dialectName: dialect.name,
            syntax: dialect.syntax,
            text: ordered.join(' ').replace(/\s+/g, ' ').trim(),
            steps,
            parts: { subject: subjectText, verb: verbText, object: objectText }
        };
    }

    function tokenizeEnglishPhrase(phrase) {
        return String(phrase || '')
            .replace(/[!?.,;:]/g, ' ')
            .split(/\s+/)
            .map((t) => normalizeToken(t))
            .filter((t) => t && !ARTICLE_WORDS.has(t));
    }

    function guessVerbIndex(tokens, dialectId) {
        const id = resolveDialectId(dialectId);
        for (let i = 0; i < tokens.length; i += 1) {
            const row = LOOKUP.englishToDialect[id][tokens[i]];
            if (!row) continue;
            const keys = row.englishKeys.join(' ').toLowerCase();
            if (/(burn|count|mourn|awaken|arise|obeys|obey|serve|drink|die|remain|win|fall|protect|trade|pour)/.test(keys)) {
                return i;
            }
        }
        return tokens.length > 1 ? 1 : 0;
    }

    function translateEnglishPhrase(dialectId, englishPhrase, options = {}) {
        const id = resolveDialectId(dialectId);
        if (!id) {
            return { dialectId: null, text: String(englishPhrase || ''), warning: 'Unknown dialect/region/nation.' };
        }

        const tokens = tokenizeEnglishPhrase(englishPhrase);
        if (!tokens.length) {
            return { dialectId: id, text: '', steps: [] };
        }

        const imperative = options.imperative != null
            ? !!options.imperative
            : /!/.test(String(englishPhrase));

        const verbIndex = guessVerbIndex(tokens, id);
        const verbToken = tokens[verbIndex];
        const other = tokens.filter((_, idx) => idx !== verbIndex);

        const dialect = DIALECTS[id];
        const pluralObject = /shields|forests|raiders|children|clans|guards|orders/i.test(englishPhrase);

        if (dialect.syntax === 'OVS' && other.length >= 2) {
            return translateStructured(id, {
                object: other[other.length - 1],
                verb: verbToken,
                subject: other[0],
                imperative,
                plural: { object: pluralObject }
            });
        }

        if (dialect.syntax === 'SVO') {
            if (imperative && other.length >= 1) {
                return translateStructured(id, {
                    verb: verbToken,
                    object: other[0],
                    imperative: true,
                    plural: { object: pluralObject }
                });
            }
            return translateStructured(id, {
                subject: other[0],
                verb: verbToken,
                object: other[1],
                plural: { object: pluralObject }
            });
        }

        if (dialect.syntax === 'SOV' && other.length >= 2) {
            return translateStructured(id, {
                subject: other[0],
                object: other[1],
                verb: verbToken
            });
        }

        if (dialect.syntax === 'VSO' && other.length >= 1) {
            return translateStructured(id, {
                verb: verbToken,
                subject: other.length >= 2 ? other : other[0],
                object: other.length > 2 ? other[other.length - 1] : undefined
            });
        }

        if (dialect.syntax === 'CASE' && other.length >= 2) {
            return translateStructured(id, {
                subject: other[0],
                object: other[1],
                verb: verbToken,
                eliteAddress: !!options.eliteAddress
            });
        }

        return translateStructured(id, {
            verb: verbToken,
            subject: other[0],
            object: other[1],
            imperative,
            plural: { object: pluralObject }
        });
    }

    function parseDialectTokens(dialectPhrase) {
        return String(dialectPhrase || '')
            .toLowerCase()
            .replace(/[!?.,;:]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    function stripReachAffixes(token) {
        return token
            .replace(/um$/i, '')
            .replace(/tas$/i, '')
            .replace(/vass$/i, '');
    }

    function translateDialectToEnglish(dialectId, dialectPhrase) {
        const id = resolveDialectId(dialectId);
        if (!id) return { english: String(dialectPhrase || ''), dialectId: null };

        const tokens = parseDialectTokens(dialectPhrase).map((token) => {
            let bare = token;
            if (id === DIALECT_IDS.woodland && /^vkh-/.test(bare)) bare = bare.slice(4);
            if (id === DIALECT_IDS.ridge && /^ex-/.test(bare)) bare = bare.slice(3);
            if (id === DIALECT_IDS.gulf && /^(sha-|eru-)/.test(bare)) bare = bare.replace(/^(sha-|eru-)/, '');
            if (id === DIALECT_IDS.reach) bare = stripReachAffixes(bare);
            if (id === DIALECT_IDS.woodland && /-ag$/.test(bare)) bare = bare.slice(0, -3);
            return bare;
        });

        const englishWords = tokens.map((bare) => {
            const row = LOOKUP.dialectToEnglish[id][normalizeToken(bare)];
            if (row && row.englishKeys.length) {
                return row.englishKeys[0].split('/')[0].trim().toLowerCase();
            }
            return bare;
        });

        const dialect = DIALECTS[id];
        let ordered = englishWords;

        if (dialect.syntax === 'OVS' && ordered.length === 3) {
            ordered = [ordered[2], ordered[0], ordered[1]];
        } else if (dialect.syntax === 'SOV' && ordered.length === 3) {
            ordered = [ordered[0], ordered[1], ordered[2]];
        } else if (dialect.syntax === 'VSO' && ordered.length >= 2) {
            ordered = [ordered[1], ordered.slice(2).join(' '), ordered[0]].filter(Boolean);
        } else if (dialect.syntax === 'CASE' && ordered.length === 3) {
            ordered = [`the ${ordered[0]}`, ordered[2], `the ${ordered[1]}`];
        } else if (dialect.syntax === 'SVO' && ordered.length >= 2) {
            ordered = ordered;
        }

        const english = ordered.join(' ').replace(/\s+/g, ' ').trim();
        return {
            dialectId: id,
            english: english.charAt(0).toUpperCase() + english.slice(1) + (/\!/.test(String(dialectPhrase)) ? '!' : '.'),
            syntax: dialect.syntax
        };
    }

    function validateSpecExamples() {
        return [
            {
                label: 'Woodland — "The raider burns the forest."',
                result: translateEnglishPhrase(DIALECT_IDS.woodland, 'The raider burns the forest.')
            },
            {
                label: 'Ridge — "Awaken the shields!"',
                result: translateEnglishPhrase(DIALECT_IDS.ridge, 'Awaken the shields!', { imperative: true })
            },
            {
                label: 'Basin — "The merchant counts gold."',
                result: translateEnglishPhrase(DIALECT_IDS.basin, 'The merchant counts gold.')
            },
            {
                label: 'Gulf — "The ancient children mourn."',
                result: translateEnglishPhrase(DIALECT_IDS.gulf, 'The ancient children mourn.')
            },
            {
                label: 'Reach — "The guard obeys the order."',
                result: translateEnglishPhrase(DIALECT_IDS.reach, 'The guard obeys the order.')
            }
        ];
    }

    global.RoyalArmiesAmnekLanguageNetwork = {
        DIALECT_IDS,
        REGION_DIALECT,
        NATION_DIALECT,
        REGION_LABELS,
        getDialectForRegion: (regionId) => REGION_DIALECT[String(regionId || '').trim()] || null,
        getDialectForNation: (nationId) => NATION_DIALECT[String(nationId || '').trim().toLowerCase()] || null,
        getDialectMeta,
        listDialects: () => Object.values(DIALECTS).map((d) => ({
            id: d.id,
            name: d.name,
            regionName: d.regionName,
            syntax: d.syntax,
            profile: d.profile
        })),
        lookupEnglishWord,
        translateStructured,
        translateEnglishPhrase,
        translateToDialect: translateEnglishPhrase,
        translateToEnglish: translateDialectToEnglish,
        synthesizeTerm,
        validateSpecExamples
    };
})(typeof window !== 'undefined' ? window : globalThis);
